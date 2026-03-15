import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const userData = {
  find: (where: Prisma.UserWhereInput, select?: Prisma.UserSelect) =>
    prisma.user.findFirst({ where, select }),

  findUnique: (where: Prisma.UserWhereUniqueInput, select?: Prisma.UserSelect) =>
    prisma.user.findUnique({ where, select }),

  create: (data: Prisma.UserCreateInput) =>
    prisma.user.create({ data }),
};
