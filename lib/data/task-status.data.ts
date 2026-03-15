import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const taskStatusData = {
  findMany: (options?: { orderBy?: Prisma.TaskStatusOrderByWithRelationInput }) =>
    prisma.taskStatus.findMany(options),

  findUniqueOrThrow: (where: Prisma.TaskStatusWhereUniqueInput) =>
    prisma.taskStatus.findUniqueOrThrow({ where }),
};
