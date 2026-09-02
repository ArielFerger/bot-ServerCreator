# Desplegar AriBuilder para que lo use cualquiera

Esto es lo que hay que hacer para pasar de «funciona en mi máquina» a **una instancia pública**:
una web donde cualquiera entra con su cuenta de Discord, invita a **AriBuilder** a su servidor y
aplica plantillas, sin crear ningún bot ni tocar código.

La diferencia con el desarrollo en local son tres cosas: Postgres en vez de SQLite, un dominio con
HTTPS, y el bot marcado como público en Discord.

---

## 1. La aplicación de Discord

En <https://discord.com/developers/applications>:

1. **New Application** → nombre: `AriBuilder`. Es el nombre que ve la gente al invitarlo.
2. Pestaña **Bot**:
   - *Reset Token* → guardá el token, es `DISCORD_BOT_TOKEN`. No se vuelve a mostrar.
   - **Public Bot: activado.** Sin esto solo vos podés invitarlo, que es justo lo contrario de lo
     que buscamos.
   - **Requires OAuth2 Code Grant: desactivado.** Si está activo, el enlace de invitación falla.
   - No hace falta activar ningún *Privileged Gateway Intent*: AriBuilder no lee mensajes ni la
     lista de miembros.
3. Pestaña **OAuth2**: copiá *Client ID* y *Client Secret*.
4. **OAuth2 → Redirects**: añadí exactamente la URL pública seguida de la ruta de callback:

   ```
   https://TU-DOMINIO/api/auth/callback/discord
   ```

   Tiene que coincidir carácter por carácter con `AUTH_URL`, o el login falla con
   *redirect_uri mismatch*.

Conviene además rellenar la descripción y el icono de la aplicación: es lo que Discord enseña en el
diálogo de invitación, y un bot sin descripción da menos confianza a quien lo va a meter en su
servidor.

## 2. Las variables de entorno

```bash
cp .env.example .env
```

| Variable | Qué es |
|---|---|
| `DISCORD_BOT_TOKEN` | Pestaña Bot. |
| `DISCORD_CLIENT_ID` | Pestaña OAuth2. |
| `DISCORD_CLIENT_SECRET` | Pestaña OAuth2. |
| `AUTH_SECRET` | `openssl rand -base64 32`. Si cambia, se cierran todas las sesiones. |
| `AUTH_URL` | La URL pública con `https://`, sin barra final. |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24`. Solo la usa el compose. |
| `DATABASE_URL` | La construye el compose. Solo hace falta ponerla si usás una base externa. |

Comprobá antes de desplegar:

```bash
npm run comprobar
```

Valida el token contra Discord, avisa si el bot todavía no se llama AriBuilder y recuerda el
Redirect exacto que tiene que estar configurado, calculado desde tu `AUTH_URL`.

## 3. Levantarlo

```bash
docker compose up --build -d
```

Arranca cuatro servicios desde el mismo `Dockerfile`:

- `db` — Postgres 17, con su volumen. **Postgres y no SQLite** porque el disco de un contenedor es
  efímero y porque la web y el bot son dos procesos: con un archivo compartido, cualquier despliegue
  que los reparta en máquinas distintas dejaría de funcionar sin avisar.
- `init-db` — crea o actualiza el esquema y termina. Los otros dos esperan a que acabe bien.
- `web` — la web en el puerto 3000.
- `bot` — la conexión permanente con Discord: botones de auto-rol y `/plantilla`.

El `provider` de Prisma se fija al construir la imagen a partir de la URL, porque Prisma no admite
`env()` en esa línea del esquema. Lo hace `scripts/proveedor-db.mjs` y el compose ya le pasa el
`build arg`; no hay que editar `prisma/schema.prisma` a mano.

## 4. HTTPS y dominio

`web` escucha en el 3000 sin TLS: delante hace falta un proxy inverso. Con Caddy son dos líneas y el
certificado se renueva solo:

```caddyfile
aribuilder.tudominio.com {
    reverse_proxy localhost:3000
}
```

Con nginx o Traefik vale igual, pero acordate de **no bufferizar**: la pantalla de progreso usa SSE
y un proxy que acumula la respuesta la deja parecer colgada dos minutos. En nginx:

```nginx
proxy_buffering off;
proxy_read_timeout 300s;   # aplicar una plantilla grande pasa del minuto
```

## 5. Registrar `/plantilla` globalmente

Una vez, desde una máquina con el `.env` puesto:

```bash
npm run registrar
```

Global significa en todos los servidores donde esté AriBuilder. Discord tarda hasta una hora en
propagarlo. Para probar al instante en un servidor concreto: `npm run registrar -- <ID-DEL-SERVIDOR>`.

## 6. Comprobar que funciona

1. Entrá a `https://TU-DOMINIO` desde una cuenta que **no** sea la tuya de siempre.
2. *Entrar con Discord* → tiene que salir la lista de servidores.
3. Invitá al bot a un servidor de prueba y aplicá una plantilla de la galería.
4. En Discord, el bot tiene que aparecer llamándose **AriBuilder**.
5. Probá *Deshacer*.

En los logs del bot (`docker compose logs -f bot`) se ve el nombre con el que se conectó y cada
servidor nuevo al que lo añaden.

---

## Cosas que conviene saber antes de abrirlo al mundo

**Un solo token para todos.** Todas las aplicaciones pasan por el mismo bot, así que comparten los
límites de peticiones de Discord. `@discordjs/rest` los respeta y encola, de forma que con mucha
concurrencia las aplicaciones tardan más, pero no fallan. Si llega a molestar, lo que toca es una
cola de trabajos en vez de aplicar dentro de la petición HTTP.

**A partir de 2.500 servidores Discord obliga a usar sharding.** El bot de gateway tendría que
arrancar con `ShardingManager`. Bastante antes de eso conviene también dejar de listar todos los
servidores del bot en cada carga de página (`servidoresDelBot()` en `apps/web/lib/discord.ts`,
que hoy pagina de 200 en 200) y guardar la pertenencia en la base desde los eventos del bot.

**Quién puede aplicar qué.** La web nunca se fía de la sesión a secas: antes de aplicar le pregunta
a Discord por la lista de servidores *del usuario* y comprueba que sea dueño o tenga «Gestionar
servidor» en ese servidor concreto (`autorizado()` en `apps/web/app/api/aplicar/route.ts`). El
comando `/plantilla` exige el mismo permiso.

**El modo demostración no existe en producción.** La puerta trasera del editor tiene dos cerrojos
independientes: se apaga con `NODE_ENV=production` y solo responde a peticiones desde la propia
máquina. Las imágenes de Docker ya llevan `NODE_ENV=production`.

**Copias de seguridad.** En la base están las plantillas de la gente y los paneles de auto-rol. Si
se pierden los paneles, los botones ya publicados en Discord dejan de repartir roles.

```bash
docker compose exec db pg_dump -U aribuilder aribuilder > copia-$(date +%F).sql
```

**Actualizar.**

```bash
git pull && docker compose up --build -d
```

`init-db` vuelve a correr y aplica los cambios de esquema antes de que arranquen web y bot.

---

## Alternativas al VPS

El `Dockerfile` tiene tres destinos (`web`, `bot`, `init-db`), así que sirve tal cual en cualquier
sitio que construya imágenes de Docker. Lo que cambia es dónde poner cada cosa:

- **Railway, Render, Fly.io.** Postgres gestionado + dos servicios apuntando al mismo repo, uno con
  `--target web` y otro con `--target bot`, ambos con la misma `DATABASE_URL`. El esquema se aplica
  con un *release command* o un job que ejecute `npx prisma db push`.
- **Vercel para la web.** Es el camino más rápido para abrirlo al público y tiene guía propia:
  **[VERCEL.md](VERCEL.md)**. El bot **no** puede correr ahí —necesita una conexión permanente— pero
  resulta que casi todo funciona sin él: entrar, invitar a AriBuilder y aplicar plantillas lo hace la
  web por REST. Solo los botones de auto-rol y `/plantilla` piden un proceso encendido, que se puede
  añadir después.
