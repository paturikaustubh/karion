import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const taskActivityData = {
  find: (where: Prisma.TaskActivityWhereInput, include?: Prisma.TaskActivityInclude) =>
    prisma.taskActivity.findFirst({ where, include }),

  findMany: (
    where: Prisma.TaskActivityWhereInput,
    options?: {
      include?: Prisma.TaskActivityInclude;
      orderBy?: Prisma.TaskActivityOrderByWithRelationInput;
      take?: number;
    }
  ) => prisma.taskActivity.findMany({ where, ...options }),

  create: (data: Prisma.TaskActivityCreateInput) =>
    prisma.taskActivity.create({ data }),
};
