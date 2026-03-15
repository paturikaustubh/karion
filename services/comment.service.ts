import { CreateCommentInput, UpdateCommentInput } from "@/lib/validations/comment";
import { logActivity } from "./activity-log.service";
import { resolveSourceId } from "@/lib/lookup";
import { taskData } from "@/lib/data/task.data";
import { taskCommentData } from "@/lib/data/task-comment.data";

const commentInclude = {
  commentSource: { select: { sourceName: true, displayName: true } },
};

export async function getComments(taskId: string, userId: number) {
  const task = await taskData.find({ taskId, createdBy: userId, isActive: true });
  if (!task) return [];

  return taskCommentData.findMany(
    { taskId: task.id, isActive: true },
    { include: commentInclude, orderBy: { createdAt: "asc" } }
  );
}

export async function createComment(taskId: string, input: CreateCommentInput, userId: number) {
  const task = await taskData.find({ taskId, createdBy: userId, isActive: true });
  if (!task) return null;

  const commentSourceId = await resolveSourceId(input.source ?? "web");

  const comment = await taskCommentData.create(
    {
      task: { connect: { id: task.id } },
      comment: input.comment,
      commentSource: { connect: { id: commentSourceId } },
      creator: { connect: { id: userId } },
    },
    commentInclude
  );

  await logActivity("comment_added", `Comment added to task`, userId, taskId, {
    commentId: comment.taskCommentId,
    source: input.source,
    preview: input.comment.substring(0, 100),
  });

  return comment;
}

export async function updateComment(
  taskId: string,
  commentId: string,
  input: UpdateCommentInput,
  userId: number
) {
  const comment = await taskCommentData.find({ taskCommentId: commentId, createdBy: userId, isActive: true });
  if (!comment) return null;

  const updated = await taskCommentData.update(
    { id: comment.id },
    { comment: input.comment },
    commentInclude
  );

  await logActivity("comment_updated", `Comment updated`, userId, taskId, { commentId });

  return updated;
}

export async function deleteComment(taskId: string, commentId: string, userId: number) {
  const comment = await taskCommentData.find({ taskCommentId: commentId, createdBy: userId, isActive: true });
  if (!comment) return null;

  await taskCommentData.softDelete({ id: comment.id });

  await logActivity("comment_deleted", `Comment deleted`, userId, taskId, { commentId });

  return comment;
}
