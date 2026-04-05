import { eq, and, desc, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, questions, examSessions, examResults, notificationPreferences, exams, userGroups } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

function extractInsertId(result: unknown): number {
  if (typeof result === "object" && result !== null && "insertId" in result) {
    const insertId = (result as { insertId: unknown }).insertId;
    if (typeof insertId === "number" && Number.isFinite(insertId)) {
      return insertId;
    }
  }

  throw new Error("Insert did not return a valid insertId");
}

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function createManagerAccount(data: {
  openId: string;
  name: string;
  email: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    loginMethod: "manager",
    role: "admin",
    lastSignedIn: new Date(),
  });

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, data.openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Question queries
export async function getQuestionsByTopic(topic: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(questions).where(eq(questions.topic, topic));
}

export async function getAllQuestions() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(questions);
}

export async function getQuestionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(questions).where(eq(questions.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createQuestion(data: {
  subject: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: "A" | "B" | "C" | "D";
  explanation?: string | null;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(questions).values({
    subject: data.subject,
    topic: data.topic,
    difficulty: data.difficulty,
    questionText: data.questionText,
    optionA: data.optionA,
    optionB: data.optionB,
    optionC: data.optionC,
    optionD: data.optionD,
    correctAnswer: data.correctAnswer,
    explanation: data.explanation ?? null,
    createdBy: data.createdBy,
  });

  return extractInsertId(result);
}

export async function updateQuestion(
  id: number,
  data: {
    subject?: string;
    topic?: string;
    difficulty?: "easy" | "medium" | "hard";
    questionText?: string;
    optionA?: string;
    optionB?: string;
    optionC?: string;
    optionD?: string;
    correctAnswer?: "A" | "B" | "C" | "D";
    explanation?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(questions).set(data).where(eq(questions.id, id));
}

export async function deleteQuestion(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(questions).where(eq(questions.id, id));
}

export async function getRandomQuestions(count: number, topic?: string) {
  const db = await getDb();
  if (!db) return [];

  let allQuestions: any[] = [];
  if (topic) {
    allQuestions = await db.select().from(questions).where(eq(questions.topic, topic));
  } else {
    allQuestions = await db.select().from(questions);
  }

  // Shuffle and return requested count
  return allQuestions.sort(() => Math.random() - 0.5).slice(0, count);
}

// Exam session queries
export async function createExamSession(userId: number, totalQuestions: number, timeLimit: number, questionIds?: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(examSessions).values({
    userId,
    totalQuestions,
    timeLimit,
    questionIds: questionIds ?? [],
    status: "in_progress",
  });

  return extractInsertId(result);
}

export async function getExamSession(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(examSessions).where(eq(examSessions.id, sessionId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateExamSession(sessionId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(examSessions).set(data).where(eq(examSessions.id, sessionId));
}

export async function submitExamSession(sessionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(examSessions).set({
    status: "submitted",
    endedAt: new Date(),
  }).where(eq(examSessions.id, sessionId));
}

// Exam result queries
export async function createExamResult(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(examResults).values(data);
  return extractInsertId(result);
}

export async function getExamResult(resultId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(examResults).where(eq(examResults.id, resultId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserExamResults(userId: number) {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(examResults)
    .where(eq(examResults.userId, userId))
    .orderBy(desc(examResults.createdAt));
}

// Notification preferences
export async function getNotificationPreferences(userId: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createOrUpdateNotificationPreferences(userId: number, data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const existing = await getNotificationPreferences(userId);

  if (existing) {
    return await db.update(notificationPreferences)
      .set(data)
      .where(eq(notificationPreferences.userId, userId));
  } else {
    return await db.insert(notificationPreferences).values({
      userId,
      ...data,
    });
  }
}

// Exam management queries
export async function createExam(data: {
  name: string;
  description?: string;
  duration: number;
  availableAt: Date;
  questionIds: number[];
  subjectCounts?: Array<{ subject: string; count: number }>;
  groups?: Array<{ id: string; name: string }>;
  shuffleQuestionsPerUser?: boolean;
  showResultsAfterSubmission: boolean;
  createdBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(exams).values({
    name: data.name,
    description: data.description,
    duration: data.duration,
    availableAt: data.availableAt,
    questionIds: data.questionIds,
    subjectCounts: data.subjectCounts ?? [],
    groups: data.groups ?? [],
    shuffleQuestionsPerUser: data.shuffleQuestionsPerUser ?? true,
    showResultsAfterSubmission: data.showResultsAfterSubmission,
    createdBy: data.createdBy,
  });

  const result = await db.select().from(exams)
    .where(eq(exams.name, data.name))
    .orderBy(desc(exams.createdAt))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllExams() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(exams).orderBy(desc(exams.createdAt));
}

export async function getExamById(id: number) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(exams).where(eq(exams.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateExam(id: number, data: {
  name?: string;
  description?: string;
  duration?: number;
  availableAt?: Date;
  questionIds?: number[];
  subjectCounts?: Array<{ subject: string; count: number }>;
  groups?: Array<{ id: string; name: string }>;
  shuffleQuestionsPerUser?: boolean;
  showResultsAfterSubmission?: boolean;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.duration !== undefined) updateData.duration = data.duration;
  if (data.availableAt !== undefined) updateData.availableAt = data.availableAt;
  if (data.questionIds !== undefined) updateData.questionIds = data.questionIds;
  if (data.subjectCounts !== undefined) updateData.subjectCounts = data.subjectCounts;
  if (data.groups !== undefined) updateData.groups = data.groups;
  if (data.shuffleQuestionsPerUser !== undefined) updateData.shuffleQuestionsPerUser = data.shuffleQuestionsPerUser;
  if (data.showResultsAfterSubmission !== undefined) updateData.showResultsAfterSubmission = data.showResultsAfterSubmission;

  return await db.update(exams).set(updateData).where(eq(exams.id, id));
}

export async function deleteExam(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.delete(exams).where(eq(exams.id, id));
}

// User group queries
export async function getAllUserGroups() {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(userGroups).orderBy(userGroups.name);
}

export async function getUserGroupByName(name: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(userGroups).where(eq(userGroups.name, name)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createUserGroup(name: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(userGroups).values({
    name,
    description,
  });

  return await getUserGroupByName(name);
}

export async function setUserGroup(userId: number, groupName: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.update(users)
    .set({
      userGroup: groupName,
      groupSelectedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

// Subject/Topic queries
export async function getAllSubjects() {
  const db = await getDb();
  if (!db) return [];

  const result = await db.select({ subject: questions.subject })
    .from(questions)
    .limit(1000); // Arbitrary limit to avoid too many results

  // Get unique subjects
  const subjects = Array.from(new Set(result.map(r => r.subject))).sort();
  return subjects;
}

export async function getQuestionsBySubject(subject: string) {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(questions)
    .where(eq(questions.subject, subject))
    .orderBy(questions.topic, questions.id);
}

export async function getQuestionsBySubjects(subjects: string[]) {
  const db = await getDb();
  if (!db) return [];

  if (subjects.length === 0) return [];

  // Get all questions where subject is in the provided list
  const allQuestions: typeof questions.$inferSelect[] = [];

  for (const subject of subjects) {
    const subjectQuestions = await getQuestionsBySubject(subject);
    allQuestions.push(...subjectQuestions);
  }

  return allQuestions;
}
