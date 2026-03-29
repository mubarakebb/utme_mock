import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
  json,
  longtext,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extended with role-based access for students and admins.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  userGroup: varchar("userGroup", { length: 255 }), // e.g., "2027 UTME", "2028 UTME"
  groupSelectedAt: timestamp("groupSelectedAt"), // When user selected their group
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * User groups table - cohorts/batches of users
 */
export const userGroups = mysqlTable("userGroups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().unique(), // e.g., "2027 UTME", "2028 UTME"
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserGroup = typeof userGroups.$inferSelect;
export type InsertUserGroup = typeof userGroups.$inferInsert;

/**
 * Mathematics questions table with multiple-choice options
 */
export const questions = mysqlTable("questions", {
  id: int("id").autoincrement().primaryKey(),
  subject: varchar("subject", { length: 255 }).notNull(), // e.g., "Mathematics", "English", "Physics"
  topic: varchar("topic", { length: 255 }).notNull(), // e.g., "Algebra", "Geometry", "Trigonometry"
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull(),
  questionText: longtext("questionText").notNull(),
  optionA: longtext("optionA").notNull(),
  optionB: longtext("optionB").notNull(),
  optionC: longtext("optionC").notNull(),
  optionD: longtext("optionD").notNull(),
  correctAnswer: mysqlEnum("correctAnswer", ["A", "B", "C", "D"]).notNull(),
  explanation: longtext("explanation"), // Optional explanation for the answer
  createdBy: int("createdBy").notNull(), // Admin user ID
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Question = typeof questions.$inferSelect;
export type InsertQuestion = typeof questions.$inferInsert;

/**
 * Exam sessions track active exams for users
 */
export const examSessions = mysqlTable("examSessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  status: mysqlEnum("status", ["in_progress", "submitted", "abandoned"]).default("in_progress").notNull(),
  totalQuestions: int("totalQuestions").notNull(),
  timeLimit: int("timeLimit").notNull(), // in seconds
  currentQuestionIndex: int("currentQuestionIndex").default(0).notNull(),
  selectedAnswers: json("selectedAnswers").$type<Record<number, string>>().default({}).notNull(), // Map of question ID to selected option
  questionIds: json("questionIds").$type<number[]>().default([]).notNull(), // Ordered list of question IDs shown to this user
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExamSession = typeof examSessions.$inferSelect;
export type InsertExamSession = typeof examSessions.$inferInsert;

/**
 * Exam results store final scores and performance data
 */
export const examResults = mysqlTable("examResults", {
  id: int("id").autoincrement().primaryKey(),
  examSessionId: int("examSessionId").notNull(),
  userId: int("userId").notNull(),
  totalQuestions: int("totalQuestions").notNull(),
  correctAnswers: int("correctAnswers").notNull(),
  wrongAnswers: int("wrongAnswers").notNull(),
  unanswered: int("unanswered").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(), // Percentage score
  timeTaken: int("timeTaken").notNull(), // in seconds
  performanceByTopic: json("performanceByTopic").$type<Record<string, { correct: number; total: number }>>().default({}).notNull(),
  answerDetails: json("answerDetails").$type<Array<{
    questionId: number;
    selectedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
    topic: string;
  }>>().default([]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExamResult = typeof examResults.$inferSelect;
export type InsertExamResult = typeof examResults.$inferInsert;

/**
 * Notification preferences and history
 */
export const notificationPreferences = mysqlTable("notificationPreferences", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  emailOnResultsReady: boolean("emailOnResultsReady").default(true).notNull(),
  emailOnNewQuestions: boolean("emailOnNewQuestions").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreference = typeof notificationPreferences.$inferInsert;

/**
 * LLM-generated questions tracking
 */
export const generatedQuestions = mysqlTable("generatedQuestions", {
  id: int("id").autoincrement().primaryKey(),
  topic: varchar("topic", { length: 255 }).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).notNull(),
  prompt: longtext("prompt").notNull(), // The LLM prompt used
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  approvedBy: int("approvedBy"), // Admin user ID who approved it
  approvedAt: timestamp("approvedAt"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  questionId: int("questionId"), // Link to questions table after approval
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GeneratedQuestion = typeof generatedQuestions.$inferSelect;
export type InsertGeneratedQuestion = typeof generatedQuestions.$inferInsert;

/**
 * Exams table - stores exam definitions created by admins/managers
 */
export const exams = mysqlTable("exams", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  duration: int("duration").notNull(), // in minutes
  availableAt: timestamp("availableAt").notNull(), // When exam becomes available
  questionIds: json("questionIds").$type<number[]>().default([]).notNull(), // Array of question IDs
  subjectCounts: json("subjectCounts").$type<Array<{ subject: string; count: number }>>().default([]).notNull(), // Subject and question count pairs (e.g., [{subject: "Mathematics", count: 40}, {subject: "English", count: 50}])
  groups: json("groups").$type<Array<{ id: string; name: string }>>().default([]).notNull(), // Optional groups for organizing questions
  shuffleQuestionsPerUser: boolean("shuffleQuestionsPerUser").default(true).notNull(),
  showResultsAfterSubmission: boolean("showResultsAfterSubmission").default(false).notNull(),
  createdBy: int("createdBy").notNull(), // Admin/Manager user ID who created it
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Exam = typeof exams.$inferSelect;
export type InsertExam = typeof exams.$inferInsert;
