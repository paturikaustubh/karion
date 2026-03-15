import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const sourceData = {
  findUniqueOrThrow: (where: Prisma.SourceWhereUniqueInput) =>
    prisma.source.findUniqueOrThrow({ where }),
};
