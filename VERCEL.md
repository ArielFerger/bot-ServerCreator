# Poner AriBuilder en Vercel

El objetivo: alguien entra a tu web, aprieta *Entrar con Discord*, invita a AriBuilder a su servidor
y aplica una plantilla. Sin instalar nada.

**La web va en Vercel. El bot no puede.** Vercel ejecuta funciones que arrancan con cada petición y
mueren al responder; el bot necesita una conexión permanente con Discord. Ahora bien:

> **Lo que la gente hace todos los días funciona con Vercel solo.** Entrar, invitar a AriBuilder,
> ver la vista previa, aplicar una plantilla y deshacerla: todo eso lo hace la web llamando a la API
> REST de Discord con el token del bot. No hace falta ningún proceso encendido.
>
> Lo único que necesita el bot encendido es lo que **reacciona** dentro de Discord: los botones de
> auto-rol y el comando `/plantilla`. Si no lo levantás, los botones no responden.

Así que se puede empezar **solo con Vercel** y añadir el bot después. El paso 6 explica dónde.

---

## 1. Una base de datos Postgres (Supabase)

SQLite no sirve: cada función de Vercel corre en un sistema de archivos efímero y aislado, así que
un archivo no se comparte entre peticiones. Cualquier Postgres gestionado vale —Supabase, Neon, el
propio Vercel Postgres—; acá va con **Supabase**, que tiene plan gratuito.

En <https://supabase.com/dashboard> → *New project*. Guardá la contraseña de la base, que solo se
muestra una vez. Después, botón **Connect** arriba, y copiá **dos** cadenas distintas:

| De Supabase | Va en | Para qué |
|---|---|---|
| **Transaction pooler**, puerto `6543` | `DATABASE_URL` | La app. Añadile `?pgbouncer=true` al final. |
| **Session pooler**, puerto `5432` | `DIRECT_URL` | Crear las tablas (paso 4). |

Sí, hacen falta las dos, y este es el punto donde más gente se atasca. El pooler de transacciones
recicla la conexión entre sentencias: es justo lo que necesita una función serverless que aparece y
desaparece, pero es también lo que rompe a `prisma db push`, que necesita una sesión estable para
crear tablas. De ahí la segunda URL.

El `?pgbouncer=true` no es decorativo: le dice a Prisma que no use *prepared statements*, que el
pooler en modo transacción no sostiene.

Nada de esto hay que configurarlo en `prisma/schema.prisma`. `scripts/proveedor-db.mjs` ajusta solo
el `provider` y añade `directUrl` cuando detecta `DIRECT_URL` en el entorno.

## 2. Importar el repo

En <https://vercel.com/new>, importá `ArielFerger/bot-ServerCreator`. Es un monorepo, así que hay
**una sola cosa** que configurar a mano:

- **Root Directory:** `apps/web`

El resto se detecta solo. Vercel ve los workspaces de npm, instala desde la raíz y usa el script
`build` de `apps/web`, que ya genera el cliente de Prisma antes de compilar.

## 3. Las variables de entorno

En **Settings → Environment Variables** (marcalas para *Production*, *Preview* y *Development*):

| Variable | Valor |
|---|---|
| `DATABASE_URL` | La del *transaction pooler* (6543) con `?pgbouncer=true`. |
| `DIRECT_URL` | La del *session pooler* (5432). |
| `AUTH_SECRET` | `openssl rand -base64 32`. Si la cambiás, se cierran todas las sesiones. |
| `AUTH_URL` | Tu dominio con `https://` y **sin barra final**. |
| `DISCORD_CLIENT_ID` | Portal de Discord → OAuth2. |
| `DISCORD_CLIENT_SECRET` | Portal de Discord → OAuth2. |
| `DISCORD_BOT_TOKEN` | Portal de Discord → Bot. |

`AUTH_SECRET` y `DISCORD_BOT_TOKEN` son secretos de verdad: quien tenga el token controla el bot en
todos los servidores donde esté.

Sobre `AUTH_URL`: poné el dominio definitivo (`https://aribuilder.vercel.app` o el tuyo propio). Las
URLs de *preview* cambian en cada commit y nunca van a coincidir con el Redirect de Discord, así que
el login solo funcionará en producción. Es lo normal y no es un problema.

## 4. Crear el esquema en la base

La compilación de Vercel genera el cliente de Prisma, pero **no crea las tablas**. Una vez, desde tu
máquina, con la misma URL de Postgres:

```bash
DATABASE_URL="…6543/postgres?pgbouncer=true" DIRECT_URL="…5432/postgres" npm run db:push
```

Si te lo saltás, la web despliega bien y falla al iniciar sesión, porque la tabla de usuarios no
existe. Hay que repetirlo cada vez que cambie el esquema.

Con `DIRECT_URL` puesta, el script añade `directUrl` al esquema y Prisma crea las tablas por la
conexión de sesión, no por el pooler. Sin ella el `db push` puede quedarse colgado o fallar con un
error de *prepared statement* que no dice nada de todo esto.

> Ojo: `db:push` reescribe la línea `provider` de `prisma/schema.prisma` a `postgresql`. Es lo
> esperado, pero si después seguís desarrollando en local, `npm run db:proveedor` con tu `.env`
> normal la devuelve a `sqlite`.

## 5. Decirle a Discord cuál es la URL de vuelta

En <https://discord.com/developers/applications> → tu app → **OAuth2 → Redirects**, añadí
exactamente:

```
https://TU-DOMINIO/api/auth/callback/discord
```

Tiene que coincidir carácter por carácter con `AUTH_URL`. Si no, el login falla con
*redirect_uri mismatch*, que es el error número uno de este despliegue.

Y en la pestaña **Bot**, para que lo pueda invitar cualquiera y no solo vos:

- **Public Bot: activado.**
- **Requires OAuth2 Code Grant: desactivado** (si está activo, el enlace de invitación falla).

## 6. El bot, cuando lo quieras

Para los botones de auto-rol y `/plantilla` hace falta un proceso encendido. El `Dockerfile` ya
tiene el destino `bot`, así que sirve tal cual en Railway, Fly.io, Render o cualquier VPS:

```bash
docker build --target bot --build-arg DATABASE_URL="postgresql://build/build" -t aribuilder-bot .
```

Necesita `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID` y **la misma `DATABASE_URL` que la web**: es como
se entera de qué paneles de auto-rol publicó la web. Cuesta unos pocos dólares al mes; el detalle
está en [DESPLIEGUE.md](DESPLIEGUE.md).

Los comandos de barra se registran una vez, desde tu máquina:

```bash
npm run registrar
```

## 7. Comprobarlo

1. Entrá a tu dominio desde una cuenta que **no** sea la tuya de siempre, o en ventana privada.
2. *Entrar con Discord* → tiene que aparecer tu lista de servidores.
3. Invitá a AriBuilder a un servidor de prueba y aplicá una plantilla de la galería.
4. Probá *Deshacer*.

---

## Detalles que te van a morder si no los sabés

**La pantalla de progreso.** Aplicar una plantilla grande tarda uno o dos minutos por los límites de
Discord, y el progreso viaja por SSE. Las rutas ya declaran `maxDuration = 300`, que es justo el
techo del plan Hobby con Fluid compute (activado por defecto). Si aun así se corta, es que la
plantilla es enorme: partila o mové el trabajo a un servicio con el bot.

**Un token para todos.** Todas las aplicaciones pasan por el mismo bot y comparten los límites de
peticiones de Discord. Con mucha gente a la vez tardan más, pero no fallan.

**Nadie puede tocar servidores ajenos.** Antes de aplicar, la web le pregunta a Discord por la lista
de servidores *del usuario* y exige que sea dueño o tenga «Gestionar servidor» en ese servidor
concreto. La sesión por sí sola no basta.

**El modo demostración no se activa en Vercel.** Requiere `NODE_ENV` distinto de `production` y que
la petición venga de la propia máquina. En Vercel no se cumple ninguna de las dos.

**Los despliegues de *preview* no pueden iniciar sesión**, porque su URL no está en los Redirects de
Discord. Para probar el editor sin Discord, usá el modo demostración en local.
