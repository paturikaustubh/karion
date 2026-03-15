import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const taskSessionData = {
  find: (where: Prisma.TaskSessionWhereInput, include?: Prisma.TaskSessionInclude) =>
    prisma.taskSession.findFirst({ where, include }),

  findMany: (
    where: Prisma.TaskSessionWhereInput,
    options?: {
      include?: Prisma.TaskSessionInclude;
      orderBy?: Prisma.TaskSessionOrderByWithRelationInput;
      take?: number;
    }
  ) => prisma.taskSession.findMany({ where, ...options }),

  create: (data: Prisma.TaskSessionCreateInput, include?: Prisma.TaskSessionInclude) =>
    prisma.taskSession.create({ data, include }),

  update: (
    where: Prisma.TaskSessionWhereUniqueInput,
    data: Prisma.TaskSessionUpdateInput,
    include?: Prisma.TaskSessionInclude
  ) => prisma.taskSession.update({ where, data, include }),
};
