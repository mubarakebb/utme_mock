import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, adminProcedure, ownerAdminProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  getRandomQuestions,
  getAllQuestions,
  createExamSession,
  getExamSession,
  updateExamSession,
  submitExamSession,
  createExamResult,
  getExamResult,
  getUserExamResults,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getAllUsers,
  createManagerAccount,
  getUserByOpenId,
  createExam,
  getAllExams,
  getExamById,
  updateExam,
  deleteExam,
  getAllUserGroups,
  getUserGroupByName,
  createUserGroup,
  setUserGroup,
  getAllSubjects,
  getQuestionsBySubject,
  getQuestionsBySubjects,
} from "./db";
import { TRPCError } from "@trpc/server";

const shuffleInPlace = <T,>(items: T[]): T[] => {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const questionPayloadSchema = z.object({
  subject: z.string().min(1),
  topic: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  questionText: z.string().min(1),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctAnswer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string().optional(),
});

const questionUpdatePayloadSchema = z
  .object({
    subject: z.string().min(1).optional(),
    topic: z.string().min(1).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    questionText: z.string().min(1).optional(),
    optionA: z.string().min(1).optional(),
    optionB: z.string().min(1).optional(),
    optionC: z.string().min(1).optional(),
    optionD: z.string().min(1).optional(),
    correctAnswer: z.enum(["A", "B", "C", "D"]).optional(),
    explanation: z.string().nullable().optional(),
  })
  .refine((input: Record<string, unknown>) => Object.keys(input).length > 0, {
    message: "At least one field must be provided for update",
  });

const questionBulkPayloadSchema = z.array(questionPayloadSchema).min(1).max(500);

const buildQuestionDuplicateKey = (question: {
  subject: string;
  topic: string;
  questionText: string;
}) => `${question.subject.trim().toLowerCase()}::${question.topic.trim().toLowerCase()}::${question.questionText.trim().toLowerCase()}`;

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    setUserGroup: protectedProcedure
      .input(z.object({ groupName: z.string().min(1) }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user || ctx.user.role !== "user") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only users can set their group",
          });
        }

        // Verify group exists
        const group = await getUserGroupByName(input.groupName);
        if (!group) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User group not found",
          });
        }

        await setUserGroup(ctx.user.id, input.groupName);
        return { success: true, groupName: input.groupName };
      }),
  }),

  users: router({
    getAll: adminProcedure.query(async () => {
      return await getAllUsers();
    }),

    createManager: ownerAdminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          openId: z.string().min(3).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const managerOpenId =
          input.openId?.trim() || `manager_${crypto.randomUUID()}`;

        const existingByOpenId = await getUserByOpenId(managerOpenId);
        if (existingByOpenId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A user with this OpenID already exists",
          });
        }

        const account = await createManagerAccount({
          openId: managerOpenId,
          name: input.name.trim(),
          email: input.email.trim(),
        });

        return {
          managerOpenId,
          account,
        } as const;
      }),
  }),

  // Questions management
  questions: router({
    getAll: publicProcedure.query(async () => {
      return await getAllQuestions();
    }),

    getByTopic: publicProcedure
      .input(z.object({ topic: z.string() }))
      .query(async ({ input }) => {
        const questions = await getAllQuestions();
        return questions.filter(q => q.topic === input.topic);
      }),

    getTopics: publicProcedure.query(async () => {
      const questions = await getAllQuestions();
      const topics = new Set(questions.map(q => q.topic));
      return Array.from(topics);
    }),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getQuestionById(input.id);
      }),

    create: adminProcedure
      .input(questionPayloadSchema)
      .mutation(async ({ ctx, input }) => {
        const questionId = await createQuestion({
          ...input,
          explanation: input.explanation?.trim() ? input.explanation : null,
          createdBy: ctx.user.id,
        });

        return await getQuestionById(questionId);
      }),

    bulkCreate: adminProcedure
      .input(questionBulkPayloadSchema)
      .mutation(async ({ ctx, input }) => {
        const existingQuestions = await getAllQuestions();
        const knownKeys = new Set(
          existingQuestions.map((question: { subject: string; topic: string; questionText: string }) =>
            buildQuestionDuplicateKey({
              subject: question.subject,
              topic: question.topic,
              questionText: question.questionText,
            })
          )
        );

        const createdIds: number[] = [];
        const skippedDuplicateKeys: string[] = [];

        for (const question of input) {
          const duplicateKey = buildQuestionDuplicateKey(question);
          if (knownKeys.has(duplicateKey)) {
            skippedDuplicateKeys.push(duplicateKey);
            continue;
          }

          const questionId = await createQuestion({
            ...question,
            explanation: question.explanation?.trim() ? question.explanation : null,
            createdBy: ctx.user.id,
          });

          knownKeys.add(duplicateKey);
          createdIds.push(questionId);
        }

        return {
          success: true,
          createdCount: createdIds.length,
          skippedCount: skippedDuplicateKeys.length,
          createdIds,
          skippedDuplicateKeys,
        } as const;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          data: questionUpdatePayloadSchema,
        })
      )
      .mutation(async ({ input }) => {
        const existing = await getQuestionById(input.id);
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Question not found",
          });
        }

        await updateQuestion(input.id, input.data);
        return await getQuestionById(input.id);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const existing = await getQuestionById(input.id);
        if (!existing) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Question not found",
          });
        }

        await deleteQuestion(input.id);
        return { success: true } as const;
      }),
  }),

  // Exam session management
  exam: router({
    startExam: protectedProcedure
      .input(
        z.object({
          questionCount: z.number().default(40),
          timeLimit: z.number().default(3600), // 60 minutes in seconds
          topic: z.string().optional(),
          examId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          let selectedQuestions: any[] = [];
          let resolvedQuestionCount = input.questionCount;
          let resolvedTimeLimit = input.timeLimit;

          if (input.examId) {
            const exam = await getExamById(input.examId);

            if (!exam) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: "Exam not found",
              });
            }

            resolvedTimeLimit = exam.duration * 60;

            const allQuestions = await getAllQuestions();
            const byId = new Map<number, any>(
              allQuestions.map((q: any) => [q.id, q])
            );

            const fromExplicitIds = (exam.questionIds ?? [])
              .map((id: number) => byId.get(id))
              .filter(Boolean);

            const fromSubjectCounts = (exam.subjectCounts ?? []).flatMap(
              (entry: { subject: string; count: number }) => {
                const pool = allQuestions.filter(
                  (q: any) => q.subject === entry.subject
                );
                const effectivePool = exam.shuffleQuestionsPerUser
                  ? shuffleInPlace([...pool])
                  : [...pool].sort((a, b) => a.id - b.id);
                return effectivePool.slice(0, Math.max(0, entry.count || 0));
              }
            );

            const merged = [...fromExplicitIds, ...fromSubjectCounts];
            const uniqueById = new Map<number, any>();
            merged.forEach((q: any) => {
              uniqueById.set(q.id, q);
            });

            selectedQuestions = Array.from(uniqueById.values());

            if (exam.shuffleQuestionsPerUser) {
              selectedQuestions = shuffleInPlace(selectedQuestions);
            } else {
              selectedQuestions = selectedQuestions.sort((a, b) => a.id - b.id);
            }

            resolvedQuestionCount = selectedQuestions.length;

            if (resolvedQuestionCount === 0) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "This exam has no available questions",
              });
            }
          } else {
            // Backward-compatible free practice mode.
            selectedQuestions = await getRandomQuestions(
              input.questionCount,
              input.topic
            );
          }

          const questionIds = selectedQuestions.map((q: any) => q.id);
          const sessionId = await createExamSession(
            ctx.user.id,
            resolvedQuestionCount,
            resolvedTimeLimit,
            questionIds
          );

          return {
            sessionId,
            questions: selectedQuestions.map(q => ({
              id: q.id,
              questionText: q.questionText,
              optionA: q.optionA,
              optionB: q.optionB,
              optionC: q.optionC,
              optionD: q.optionD,
              topic: q.topic,
              difficulty: q.difficulty,
            })),
            totalQuestions: resolvedQuestionCount,
            timeLimit: resolvedTimeLimit,
          };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }
          console.error("Error starting exam:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to start exam",
          });
        }
      }),

    getSession: protectedProcedure
      .input(z.object({ sessionId: z.number() }))
      .query(async ({ ctx, input }: any) => {
        const session = await getExamSession(input.sessionId);

        if (!session) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Exam session not found",
          });
        }

        if (session.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Unauthorized access to this exam session",
          });
        }

        return session;
      }),

    saveProgress: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          currentQuestionIndex: z.number(),
          selectedAnswers: z.record(z.string(), z.string()),
        })
      )
      .mutation(async ({ ctx, input }: any) => {
        const session = await getExamSession(input.sessionId);

        if (!session || session.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Unauthorized",
          });
        }

        return await updateExamSession(input.sessionId, {
          currentQuestionIndex: input.currentQuestionIndex,
          selectedAnswers: input.selectedAnswers,
          updatedAt: new Date(),
        });
      }),

    submitExam: protectedProcedure
      .input(
        z.object({
          sessionId: z.number(),
          selectedAnswers: z.record(z.string(), z.string()),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const session = await getExamSession(input.sessionId);

        if (!session || session.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Unauthorized",
          });
        }

        // Retrieve the exact questions that were shown to the user during this exam session
        const allQuestions = await getAllQuestions();
        const questionMap = new Map(allQuestions.map((q: any) => [q.id, q]));
        const sessionQuestions = (session.questionIds ?? [])
          .map((id: number) => questionMap.get(id))
          .filter(Boolean);

        // If migration hasn't run or old sessions don't have questionIds, fall back to fetching
        const questions = sessionQuestions.length > 0
          ? sessionQuestions
          : await getRandomQuestions(session.totalQuestions);

        let correctAnswers = 0;
        let wrongAnswers = 0;
        let unanswered = 0;
        const performanceByTopic: Record<string, { correct: number; total: number }> = {};
        const answerDetails: any[] = [];

        for (const question of questions) {
          const selectedAnswer = input.selectedAnswers[question.id.toString()];
          const isCorrect = selectedAnswer === question.correctAnswer;

          if (!selectedAnswer) {
            unanswered++;
          } else if (isCorrect) {
            correctAnswers++;
          } else {
            wrongAnswers++;
          }

          // Track by topic
          if (!performanceByTopic[question.topic]) {
            performanceByTopic[question.topic] = { correct: 0, total: 0 };
          }
          performanceByTopic[question.topic].total++;
          if (isCorrect) {
            performanceByTopic[question.topic].correct++;
          }

          answerDetails.push({
            questionId: question.id,
            selectedAnswer: selectedAnswer || null,
            correctAnswer: question.correctAnswer,
            isCorrect,
            topic: question.topic,
          });
        }

        const score = (correctAnswers / session.totalQuestions) * 100;
        const timeTaken = Math.floor(
          (new Date().getTime() - session.startedAt.getTime()) / 1000
        );

        // Submit exam session
        await submitExamSession(input.sessionId);

        // Create result
        const resultId = await createExamResult({
          examSessionId: input.sessionId,
          userId: ctx.user.id,
          totalQuestions: session.totalQuestions,
          correctAnswers,
          wrongAnswers,
          unanswered,
          score: score.toFixed(2),
          timeTaken,
          performanceByTopic,
          answerDetails,
        });

        return {
          resultId,
          score: score.toFixed(2),
          correctAnswers,
          wrongAnswers,
          unanswered,
          timeTaken,
          performanceByTopic,
        };
      }),
  }),

  // Results management
  results: router({
    getResult: protectedProcedure
      .input(z.object({ resultId: z.number() }))
      .query(async ({ ctx, input }) => {
        let result = await getExamResult(input.resultId);

        // Temporary compatibility: old client flow passes sessionId as resultId.
        if (!result) {
          const userResults = await getUserExamResults(ctx.user.id);
          result = userResults.find(
            (r: { examSessionId: number }) => r.examSessionId === input.resultId
          );
        }

        if (!result) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Result not found",
          });
        }

        if (result.userId !== ctx.user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Unauthorized access to this result",
          });
        }

        return result;
      }),

    getUserResults: protectedProcedure.query(async ({ ctx }) => {
      return await getUserExamResults(ctx.user.id);
    }),
  }),

  exams: router({
    getAll: adminProcedure.query(async () => {
      return await getAllExams();
    }),

    getAvailableForUser: protectedProcedure.query(async ({ ctx }) => {
      const exams = await getAllExams();
      const now = new Date();
      const userGroup = ctx.user.userGroup?.trim();

      return exams.filter((exam: any) => {
        const availableAt = new Date(exam.availableAt);
        if (availableAt > now) {
          return false;
        }

        const groups = Array.isArray(exam.groups) ? exam.groups : [];
        if (groups.length === 0) {
          return true;
        }

        if (!userGroup) {
          return false;
        }

        return groups.some((group: { name?: string }) =>
          (group.name ?? "").trim() === userGroup
        );
      });
    }),

    getById: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getExamById(input.id);
      }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1),
          description: z.string().optional(),
          duration: z.number().min(1),
          availableAt: z.date(),
          questionIds: z.array(z.number()).optional(),
          subjectCounts: z.array(z.object({
            subject: z.string(),
            count: z.number().min(1),
          })).optional(),
          groups: z.array(z.object({
            id: z.string(),
            name: z.string(),
          })).optional(),
          shuffleQuestionsPerUser: z.boolean().default(true),
          showResultsAfterSubmission: z.boolean().default(false),
        }).refine(
          (data: any) => (data.questionIds && data.questionIds.length > 0) || (data.subjectCounts && data.subjectCounts.length > 0),
          { message: "Must provide either questionIds or subjectCounts" }
        )
      )
      .mutation(async ({ input, ctx }) => {
        const exam = await createExam({
          name: input.name.trim(),
          description: input.description?.trim(),
          duration: input.duration,
          availableAt: input.availableAt,
          questionIds: input.questionIds || [],
          subjectCounts: input.subjectCounts,
          groups: input.groups,
          shuffleQuestionsPerUser: input.shuffleQuestionsPerUser,
          showResultsAfterSubmission: input.showResultsAfterSubmission,
          createdBy: ctx.user.id,
        });

        if (!exam) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create exam",
          });
        }

        return exam;
      }),

    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          description: z.string().optional(),
          duration: z.number().min(1).optional(),
          availableAt: z.date().optional(),
          questionIds: z.array(z.number()).optional(),
          subjectCounts: z.array(z.object({
            subject: z.string(),
            count: z.number().min(1),
          })).optional(),
          groups: z.array(z.object({
            id: z.string(),
            name: z.string(),
          })).optional(),
          shuffleQuestionsPerUser: z.boolean().optional(),
          showResultsAfterSubmission: z.boolean().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        return await updateExam(id, updateData);
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteExam(input.id);
      }),
  }),

  userGroups: router({
    getAll: publicProcedure.query(async () => {
      return await getAllUserGroups();
    }),

    getByName: publicProcedure
      .input(z.object({ name: z.string() }))
      .query(async ({ input }) => {
        return await getUserGroupByName(input.name);
      }),

    create: ownerAdminProcedure
      .input(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // Check if group already exists
        const existing = await getUserGroupByName(input.name);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User group already exists",
          });
        }

        const group = await createUserGroup(input.name.trim(), input.description?.trim());
        return group;
      }),
  }),

  subjects: router({
    getAll: publicProcedure.query(async () => {
      return await getAllSubjects();
    }),

    getBySubject: publicProcedure
      .input(z.object({ subject: z.string() }))
      .query(async ({ input }) => {
        return await getQuestionsBySubject(input.subject);
      }),

    getBySubjects: publicProcedure
      .input(z.object({ subjects: z.array(z.string()).min(1) }))
      .query(async ({ input }) => {
        return await getQuestionsBySubjects(input.subjects);
      }),
  }),
});

export type AppRouter = typeof appRouter;
