import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const taskData = {
  find: (where: Prisma.TaskWhereInput, include?: Prisma.TaskInclude) =>
    prisma.task.findFirst({ where, include }),

  findMany: (
    where: Prisma.TaskWhereInput,
    options?: {
      include?: Prisma.TaskInclude;
      orderBy?: Prisma.TaskOrderByWithRelationInput;
      take?: number;
      skip?: number;
    }
  ) => prisma.task.findMany({ where, ...options }),

  create: (data: Prisma.TaskCreateInput, include?: Prisma.TaskInclude) =>
    prisma.task.create({ data, include }),

  update: (
    where: Prisma.TaskWhereUniqueInput,
    data: Prisma.TaskUpdateInput,
    include?: Prisma.TaskInclude
  ) => prisma.task.update({ where, data, include }),

  softDelete: (where: Prisma.TaskWhereUniqueInput) =>
    prisma.task.update({ where, data: { isActive: false } }),
};
