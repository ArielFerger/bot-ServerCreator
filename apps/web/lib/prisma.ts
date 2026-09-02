import { PrismaClient } from "@prisma/client";

// En desarrollo Next recarga los módulos en caliente; sin este caché se abrirían
// conexiones nuevas en cada recarga hasta agotar el pool.
const global_ = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = global_.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") global_.prisma = prisma;
