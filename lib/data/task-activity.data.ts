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
      skip?: number;
    }
  ) => prisma.taskActivity.findMany({ where, ...options }),

  count: (where: Prisma.TaskActivityWhereInput) =>
    prisma.taskActivity.count({ where }),

  create: (data: Prisma.TaskActivityCreateInput) =>
    prisma.taskActivity.create({ data }),
};
