# 🔨 AriBuilder

Diseñá un servidor de Discord y construilo con un clic. Sin programar y sin pelearte con los permisos.

Una **web** donde elegís o diseñás la estructura del servidor (categorías, canales, roles, quién ve
qué) y un **bot**, **AriBuilder**, que lo construye de verdad en tu servidor.

## Cómo funciona

Discord **no permite que un bot cree servidores**. El flujo real es:

1. Creás un servidor vacío en Discord (el botón «+», diez segundos).
2. Invitás a AriBuilder con el enlace que te da la app, que ya lleva tu servidor y los permisos justos.
3. Elegís una plantilla, mirás la vista previa y aplicás. Si no te gusta, **Deshacer** lo quita todo.

## Usarlo

Para usarlo **no hace falta instalar nada ni saber programar**: entrás en la web de la instancia,
iniciás sesión con Discord, invitás a AriBuilder a tu servidor y aplicás una plantilla.

Si querés levantar tu propia instancia pública:

- **[VERCEL.md](VERCEL.md)** — el camino corto. La web en Vercel, gratis, en unos minutos.
- **[DESPLIEGUE.md](DESPLIEGUE.md)** — el despliegue completo con Docker: web y bot, Postgres,
  dominio con HTTPS, copias de seguridad y los límites que aparecen al crecer.

Lo que sigue es para **desarrollar** sobre el proyecto en tu máquina.

## Puesta en marcha (desarrollo)

### 1. Crear la aplicación en Discord

En <https://discord.com/developers/applications>:

1. **New Application** → llamala `AriBuilder`.
2. Pestaña **Bot** → *Reset Token* → copiá el token.
3. Pestaña **OAuth2** → copiá *Client ID* y *Client Secret*.
4. En **OAuth2 → Redirects**, añadí exactamente:
   `http://localhost:3000/api/auth/callback/discord`

### 2. Configurar el proyecto

```bash
npm install
cp .env.example .env      # y rellená los tres valores de Discord
npx auth secret           # genera AUTH_SECRET (o: openssl rand -base64 32)
npm run db:push           # crea la base SQLite
```

`db:push` ajusta antes el `provider` del esquema según tu `DATABASE_URL`: SQLite si empieza por
`file:`, Postgres si es `postgresql://`. Prisma no acepta `env()` en esa línea, así que lo hace
`scripts/proveedor-db.mjs` en vez de tener dos esquemas que se desincronizan.

### 3. Comprobar que está todo bien

```bash
npm run comprobar
```

Valida el token contra Discord, comprueba que el Client ID sea el de ese mismo bot, avisa si el bot
todavía no se llama AriBuilder y te dice en qué servidores está. Si algo falla, dice exactamente qué
arreglar.

### 4. Arrancar

```bash
npm run dev               # levanta la web (http://localhost:3000) y el bot a la vez
```

Para poder usar `/plantilla` dentro de Discord hay que registrar el comando una vez:

```bash
npm run registrar -- <ID-DE-TU-SERVIDOR>   # disponible al instante en ese servidor
npm run registrar                          # global, Discord tarda hasta una hora
```

## El editor visual

En **Mis plantillas** podés partir de cero, copiar una de la galería o subir un JSON, y después
editarla arrastrando canales.

Lo importante es cómo se editan los permisos. Un canal **no** muestra las cuarenta casillas de
Discord, muestra dos preguntas:

- **¿Quién puede ver este canal?** → Todo el mundo · Solo estos roles
- **¿Quién puede escribir?** → Todos los que lo ven · Solo estos roles · Nadie

De ahí se derivan los `permissionOverwrites` reales. Hay un modo avanzado por rol para quien quiera
la tabla completa, pero nunca es el camino por defecto.

La lectura funciona en los dos sentidos (`leerAcceso`), así que una plantilla importada o generada
por IA se abre también en el modo fácil, no solo en el avanzado.

Otros detalles del editor:

- **Vista previa en vivo** a la derecha, imitando la barra lateral de Discord, con 🔒 en lo oculto y
  📖 en lo de solo lectura.
- **Deshacer y rehacer** con `Ctrl+Z` / `Ctrl+Shift+Z`; `Ctrl+S` guarda.
- **Descargar JSON** para versionar la plantilla o compartirla.
- Borrar un rol **limpia solo** sus overwrites y lo saca de los paneles de roles; borrar una
  categoría no se lleva por delante sus canales, que pasan a estar sueltos. Sin esto la plantilla
  quedaría con referencias colgando y fallaría por un motivo que el usuario no ha causado.

### Trabajar en el editor sin credenciales de Discord

Arrancá con `npm run dev` y en la portada aparece **Entrar en modo demostración**. Un clic y ya estás
dentro, con la galería cargada como plantillas propias.

Lo que necesita Discord de verdad —listar tus servidores, aplicar, clonar— seguirá pidiendo las
credenciales.

Es una puerta trasera, así que tiene dos cerrojos independientes (`apps/web/lib/demo.ts`, con tests):

- **Nunca en producción.** Las imágenes de Docker llevan `NODE_ENV=production`, así que la ruta
  responde 404 como si no existiera y el botón no se dibuja.
- **Solo desde la propia máquina.** Se comprueba la cabecera `Host`, de forma que un `next dev`
  expuesto en una red o por un túnel tampoco la abre.

También existe `npm run demo`, que hace lo mismo desde la terminal e imprime la cookie: útil para
`curl` o para pruebas automatizadas.

## Probar el motor sin la web

Útil para desarrollar o para aplicar una plantilla desde la terminal:

```bash
# Inspeccionar una plantilla sin tocar Discord ni necesitar token
npm run aplicar -- --plantilla gaming --vista-previa

# Ver qué pasaría en un servidor real, sin aplicar nada
npm run aplicar -- --guild <ID> --plantilla gaming --seco

# Aplicar de verdad
npm run aplicar -- --guild <ID> --plantilla gaming

# Desde un archivo propio
npm run aplicar -- --guild <ID> --archivo mi-plantilla.json
```

Para copiar el ID de un servidor: Discord → Ajustes → Avanzado → Modo desarrollador, después clic
derecho sobre el servidor → *Copiar ID*.

## Clonar un servidor que ya existe

En la página de un servidor, **Guardar como plantilla** lee su estructura —canales, roles, permisos y
ajustes— y la guarda como plantilla reutilizable. Cada ID de Discord se sustituye por una clave
simbólica, que es lo que permite aplicarla después en otro servidor cualquiera.

Lo que no viaja, y se te dice cuáles son:

- Los **mensajes** y los **miembros**: son la conversación, no la estructura.
- Los **roles de bots e integraciones**, que Discord no deja recrear.
- Los **permisos puestos sobre una persona concreta** (los de rol sí viajan).
- Los **hilos**, los **stickers** y los emojis con nombres que Discord no aceptaría al crearlos.

Hay un test de ida y vuelta que aplica cada plantilla de la galería, vuelve a importar el resultado y
comprueba que la estructura, los roles y los permisos por canal coinciden.

## El bot siempre se llama AriBuilder

Hay dos nombres distintos en Discord y hacen falta los dos, porque cualquiera de ellos puede acabar
diciendo otra cosa:

- El **nombre de usuario global**, el del perfil. Se pone al arrancar. Discord solo deja cambiarlo
  dos veces por hora y rechaza los nombres ya ocupados, así que puede fallar.
- El **apodo en cada servidor**, que cualquier administrador puede cambiar desde sus ajustes. Sin
  vigilarlo, el bot se llamaría AriBuilder en todas partes menos justo donde alguien lo renombró.

Por eso `apps/bot/src/identidad.ts` lo comprueba al arrancar, al entrar en un servidor nuevo y cada
seis horas, y no una sola vez. La decisión está separada de las llamadas a Discord (`decidirApodo`)
para poder probarla: si el nombre global ya es correcto, basta con **quitar** el apodo impuesto; si
el nombre global no se pudo cambiar, el apodo es el plan B que salva el nombre.

Nada de esto es crítico: si Discord no deja renombrarlo o falta el permiso de «Cambiar apodo», se
avisa por consola y el bot sigue funcionando igual.

## El bot: auto-roles y `/plantilla`

El bot con conexión permanente hace solo lo que exige estar conectado:

**Paneles de auto-roles.** Las plantillas pueden publicar un mensaje con botones para que cada uno se
dé sus propios roles. Cada pulsación pasa por estas comprobaciones:

- El mensaje está registrado como panel nuestro **y ese panel ofrece ese rol** (un botón viejo de otro
  panel no vale).
- El rol existe, no lo gestiona una integración y está por debajo del bot en la jerarquía.
- **El rol no tiene permisos de moderación.** Aunque la plantilla solo ofreciera roles inocuos,
  alguien podría darle permisos a ese rol más adelante y el botón se convertiría en una escalada de
  privilegios. Por eso se comprueba en cada pulsación y no al crear el panel.

Cuando se rechaza, el motivo se explica en español y dice qué hacer.

**`/plantilla`.** Aplica una plantilla de la galería sin salir de Discord. Por defecto solo enseña qué
pasaría; hay que pedir `solo-ver: False` explícitamente para que construya. Solo lo ve quien tiene el
permiso «Gestionar servidor».

## Desplegar con Docker

```bash
cp .env.example .env      # rellenalo, incluida POSTGRES_PASSWORD
docker compose up --build
```

Levanta cuatro servicios desde el mismo `Dockerfile`:

- `db` — Postgres, con su volumen.
- `init-db` — crea o actualiza el esquema y termina (la imagen *standalone* de la web no lleva el CLI
  de Prisma, que es dependencia de desarrollo).
- `web` y `bot` — esperan a que `init-db` acabe bien y arrancan.

Web y bot comparten la base: es como el bot se entera de qué paneles de auto-rol publicó la web.
Ambas imágenes corren como usuario sin privilegios y pesan unos 250 MB: el bot no instala las
dependencias de la web y la web usa la salida *standalone* de Next.

Para abrirlo al público —dominio, HTTPS, copias de seguridad, límites de Discord— seguí
**[DESPLIEGUE.md](DESPLIEGUE.md)**.

## Modos de aplicación

| Modo | Qué hace |
|---|---|
| `fusionar` *(defecto)* | Añade lo que falte. No toca nada de lo que ya existe. |
| `reemplazar` | Actualiza lo que coincida por nombre y crea el resto. |
| `limpiar` | Borra canales y roles antes de construir. Pide confirmación explícita. |

## Estructura

```
packages/core      Esquema de plantilla (Zod), permisos en español, presets, claves, galería y marca
packages/applier   Planificador (función pura) + ejecutor REST + deshacer
apps/web           Next.js: login, galería, editor visual, vista previa, aplicar con progreso
apps/bot           discord.js: botones de auto-rol, comando /plantilla y el nombre AriBuilder
scripts            Utilidades: comprobador de configuración, provider de Prisma, sesión de demo
```

La pieza central es el **esquema de plantilla**: un JSON que no contiene IDs de Discord sino claves
simbólicas, lo que hace que una plantilla sirva en cualquier servidor. El motor construye un
`Map<clave, id>` mientras crea las cosas y resuelve las referencias sobre la marcha.

## Desarrollo

```bash
npm test          # 262 tests
npm run typecheck
```

`planificar()` es una función pura sin red: la vista previa y la aplicación real usan exactamente el
mismo código, así que no pueden divergir.

## Problemas conocidos de Discord que la app ya maneja

- **Jerarquía de roles.** El bot solo gestiona roles por debajo del suyo. Si está muy abajo, la app
  lo detecta antes de empezar y te dice que lo arrastres arriba en Ajustes → Roles.
- **Rate limits.** Crear 30 canales tarda uno o dos minutos. El progreso va en vivo, paso a paso.
- **Funciones de Comunidad.** Los canales de anuncios, foro y escenario necesitan la Comunidad
  activada; si no lo está, se omiten con aviso en vez de fallar.
- **Tope de emojis.** Se respeta el límite según el nivel de boost del servidor.
- **Roles peligrosos en paneles de auto-rol.** Un botón nunca reparte un rol con permisos de
  moderación, aunque la plantilla lo pidiera. Se comprueba en cada pulsación, no al crear el panel,
  porque los permisos de un rol pueden cambiar después.

## Pendiente

Generar plantillas con IA a partir de una descripción («quiero un server para mi clan de 50
personas»). El enganche está previsto —el esquema Zod serviría directamente como formato de salida
estructurada— pero no está implementado.

## Licencia

MIT (ver [LICENSE](LICENSE)). Podés usarlo, modificarlo y levantar tu propia instancia.

## Aviso

Este proyecto no está afiliado a Discord ni cuenta con su respaldo.
