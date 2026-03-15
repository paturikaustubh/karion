import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const userSessionData = {
  find: (
    where: Prisma.UserSessionWhereInput,
    include?: Prisma.UserSessionInclude
  ) => prisma.userSession.findFirst({ where, include }),

  findUnique: (
    where: Prisma.UserSessionWhereUniqueInput,
    include?: Prisma.UserSessionInclude
  ) => prisma.userSession.findUnique({ where, include }),

  create: (data: Prisma.UserSessionCreateInput) =>
    prisma.userSession.create({ data }),

  delete: (where: Prisma.UserSessionWhereUniqueInput) =>
    prisma.userSession.delete({ where }),

  deleteMany: (where: Prisma.UserSessionWhereInput) =>
    prisma.userSession.deleteMany({ where }),
};
