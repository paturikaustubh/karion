import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const taskCommentData = {
  find: (where: Prisma.TaskCommentWhereInput, include?: Prisma.TaskCommentInclude) =>
    prisma.taskComment.findFirst({ where, include }),

  findMany: (
    where: Prisma.TaskCommentWhereInput,
    options?: {
      include?: Prisma.TaskCommentInclude;
      orderBy?: Prisma.TaskCommentOrderByWithRelationInput;
      take?: number;
    }
  ) => prisma.taskComment.findMany({ where, ...options }),

  create: (data: Prisma.TaskCommentCreateInput, include?: Prisma.TaskCommentInclude) =>
    prisma.taskComment.create({ data, include }),

  update: (
    where: Prisma.TaskCommentWhereUniqueInput,
    data: Prisma.TaskCommentUpdateInput,
    include?: Prisma.TaskCommentInclude
  ) => prisma.taskComment.update({ where, data, include }),

  softDelete: (where: Prisma.TaskCommentWhereUniqueInput) =>
    prisma.taskComment.update({ where, data: { isActive: false } }),
};
