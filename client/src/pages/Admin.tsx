import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Download, FileUp, Pencil, Plus, Shield, Trash2 } from "lucide-react";

type QuestionFormState = {
    subject: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: "A" | "B" | "C" | "D";
    explanation: string;
};

type QuestionRow = {
    id: number;
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
};

type ImportQuestion = {
    subject: string;
    topic: string;
    difficulty: "easy" | "medium" | "hard";
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctAnswer: "A" | "B" | "C" | "D";
    explanation?: string;
};

type ImportPreview = {
    rows: ImportQuestion[];
    errors: string[];
    sourceName: string;
};

type ImportSummary = {
    createdCount: number;
    skippedCount: number;
};

type UserRow = {
    id: number;
    openId: string;
    name: string | null;
    email: string | null;
    loginMethod: string | null;
    role: "user" | "admin";
    createdAt: string | Date;
    updatedAt: string | Date;
    lastSignedIn: string | Date;
};

type ManagerFormState = {
    name: string;
    email: string;
    openId: string;
};

type ExamFormState = {
    name: string;
    description: string;
    duration: number;
    availableAt: string; // ISO date-time string
    subjects: Array<{ subject: string; count: number }>; // Selected subjects with question counts
    questionIds: number[]; // Manual question selection (optional)
    groups: Array<{ id: string; name: string }>;
    shuffleQuestionsPerUser: boolean;
    showResultsAfterSubmission: boolean;
};

type ExamRow = {
    id: number;
    name: string;
    description: string | null;
    duration: number;
    availableAt: string | Date;
    questionIds: number[];
    subjectCounts: Array<{ subject: string; count: number }>;
    groups: Array<{ id: string; name: string }>;
    shuffleQuestionsPerUser: boolean;
    showResultsAfterSubmission: boolean;
    createdBy: number;
    createdAt: string | Date;
    updatedAt: string | Date;
};

const INITIAL_EXAM_FORM_STATE: ExamFormState = {
    name: "",
    description: "",
    duration: 60,
    availableAt: new Date().toISOString().slice(0, 16),
    subjects: [],
    questionIds: [],
    groups: [],
    shuffleQuestionsPerUser: true,
    showResultsAfterSubmission: false,
};

const INITIAL_FORM_STATE: QuestionFormState = {
    subject: "",
    topic: "",
    difficulty: "medium",
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
    explanation: "",
};

const INITIAL_MANAGER_FORM_STATE: ManagerFormState = {
    name: "",
    email: "",
    openId: "",
};

const PAGE_SIZE = 10;

function buildQuestionDuplicateKey(question: { subject: string; topic: string; questionText: string }): string {
    return `${question.subject.trim().toLowerCase()}::${question.topic.trim().toLowerCase()}::${question.questionText.trim().toLowerCase()}`;
}

function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            const next = line[i + 1];
            if (inQuotes && next === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            cells.push(current.trim());
            current = "";
            continue;
        }

        current += char;
    }

    cells.push(current.trim());
    return cells;
}

function normalizeImportRows(
    rawRows: Record<string, unknown>[],
    existingKeys: Set<string>
): ImportPreview {
    const rows: ImportQuestion[] = [];
    const errors: string[] = [];
    const uploadKeys = new Set<string>();

    rawRows.forEach((raw, index) => {
        const rowNumber = index + 1;
        const subject = String(raw.subject ?? "").trim();
        const topic = String(raw.topic ?? "").trim();
        const difficulty = String(raw.difficulty ?? "").trim().toLowerCase();
        const questionText = String(raw.questionText ?? "").trim();
        const optionA = String(raw.optionA ?? "").trim();
        const optionB = String(raw.optionB ?? "").trim();
        const optionC = String(raw.optionC ?? "").trim();
        const optionD = String(raw.optionD ?? "").trim();
        const correctAnswer = String(raw.correctAnswer ?? "").trim().toUpperCase();
        const explanation = String(raw.explanation ?? "").trim();

        if (!subject || !topic || !questionText || !optionA || !optionB || !optionC || !optionD) {
            errors.push(`Row ${rowNumber}: Missing required fields (subject, topic, questionText, options).`);
            return;
        }

        if (!["easy", "medium", "hard"].includes(difficulty)) {
            errors.push(`Row ${rowNumber}: Difficulty must be easy, medium, or hard.`);
            return;
        }

        if (!["A", "B", "C", "D"].includes(correctAnswer)) {
            errors.push(`Row ${rowNumber}: Correct answer must be A, B, C, or D.`);
            return;
        }

        const duplicateKey = buildQuestionDuplicateKey({ subject, topic, questionText });
        if (uploadKeys.has(duplicateKey)) {
            errors.push(`Row ${rowNumber}: Duplicate in upload (same subject + topic + question text).`);
            return;
        }

        if (existingKeys.has(duplicateKey)) {
            errors.push(`Row ${rowNumber}: Already exists in question bank.`);
            return;
        }

        uploadKeys.add(duplicateKey);

        rows.push({
            subject,
            topic,
            difficulty: difficulty as "easy" | "medium" | "hard",
            questionText,
            optionA,
            optionB,
            optionC,
            optionD,
            correctAnswer: correctAnswer as "A" | "B" | "C" | "D",
            explanation: explanation || undefined,
        });
    });

    return {
        rows,
        errors,
        sourceName: "",
    };
}

export default function Admin() {
    const { user, loading, isAuthenticated } = useAuth();
    const [, setLocation] = useLocation();
    const utils = trpc.useUtils();
    const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
    const [formState, setFormState] = useState<QuestionFormState>(INITIAL_FORM_STATE);
    const [searchTerm, setSearchTerm] = useState("");
    const [topicFilter, setTopicFilter] = useState("all");
    const [difficultyFilter, setDifficultyFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
    const [managerForm, setManagerForm] = useState<ManagerFormState>(INITIAL_MANAGER_FORM_STATE);
    const [managerCreateMessage, setManagerCreateMessage] = useState<string | null>(null);
    const [examForm, setExamForm] = useState<ExamFormState>(INITIAL_EXAM_FORM_STATE);
    const [editingExamId, setEditingExamId] = useState<number | null>(null);
    const [selectedQuestionIds, setSelectedQuestionIds] = useState<number[]>([]);

    const questionsQuery = trpc.questions.getAll.useQuery(undefined, {
        enabled: !!user && user.role === "admin",
        refetchOnWindowFocus: false,
    });

    const usersQuery = trpc.users.getAll.useQuery(undefined, {
        enabled: !!user && user.role === "admin",
        refetchOnWindowFocus: false,
    });

    const createQuestionMutation = trpc.questions.create.useMutation({
        onSuccess: async () => {
            setFormState(INITIAL_FORM_STATE);
            await utils.questions.getAll.invalidate();
        },
    });

    const updateQuestionMutation = trpc.questions.update.useMutation({
        onSuccess: async () => {
            setEditingQuestionId(null);
            setFormState(INITIAL_FORM_STATE);
            await utils.questions.getAll.invalidate();
        },
    });

    const deleteQuestionMutation = trpc.questions.delete.useMutation({
        onSuccess: async () => {
            await utils.questions.getAll.invalidate();
        },
    });

    const bulkCreateMutation = trpc.questions.bulkCreate.useMutation({
        onSuccess: async (result: { createdCount: number; skippedCount: number }) => {
            setImportPreview(null);
            setImportError(null);
            setImportSummary({
                createdCount: result.createdCount,
                skippedCount: result.skippedCount,
            });
            await utils.questions.getAll.invalidate();
        },
    });

    const createManagerMutation = trpc.users.createManager.useMutation({
        onSuccess: async (result: { managerOpenId: string }) => {
            setManagerCreateMessage(`Manager account created. OpenID: ${result.managerOpenId}`);
            setManagerForm(INITIAL_MANAGER_FORM_STATE);
            await utils.users.getAll.invalidate();
        },
    });

    const examsQuery = trpc.exams.getAll.useQuery(undefined, {
        enabled: !!user && user.role === "admin",
        refetchOnWindowFocus: false,
    });

    const subjectsQuery = trpc.subjects.getAll.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });

    const userGroupsQuery = trpc.userGroups.getAll.useQuery(undefined, {
        refetchOnWindowFocus: false,
    });

    const createExamMutation = trpc.exams.create.useMutation({
        onSuccess: async () => {
            setExamForm(INITIAL_EXAM_FORM_STATE);
            setSelectedQuestionIds([]);
            setEditingExamId(null);
            await utils.exams.getAll.invalidate();
        },
    });

    const updateExamMutation = trpc.exams.update.useMutation({
        onSuccess: async () => {
            setExamForm(INITIAL_EXAM_FORM_STATE);
            setSelectedQuestionIds([]);
            setEditingExamId(null);
            await utils.exams.getAll.invalidate();
        },
    });

    const deleteExamMutation = trpc.exams.delete.useMutation({
        onSuccess: async () => {
            await utils.exams.getAll.invalidate();
        },
    });

    useEffect(() => {
        if (!loading && !isAuthenticated) {
            setLocation("/");
        }
    }, [isAuthenticated, loading, setLocation]);

    if (loading) {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
                <p className="text-muted-foreground">Loading admin dashboard...</p>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const isSaving = createQuestionMutation.isPending || updateQuestionMutation.isPending;

    const sortedQuestions = useMemo<QuestionRow[]>(() => {
        if (!questionsQuery.data) return [];
        return [...(questionsQuery.data as QuestionRow[])].sort((a, b) => b.id - a.id);
    }, [questionsQuery.data]);

    const topicOptions = useMemo(() => {
        const topics = Array.from(
            new Set(sortedQuestions.map((question: QuestionRow) => question.topic))
        ).sort();
        return topics;
    }, [sortedQuestions]);

    const filteredQuestions = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        return sortedQuestions.filter((question: QuestionRow) => {
            if (topicFilter !== "all" && question.topic !== topicFilter) {
                return false;
            }

            if (difficultyFilter !== "all" && question.difficulty !== difficultyFilter) {
                return false;
            }

            if (!normalizedSearch) {
                return true;
            }

            const haystack = [
                question.topic,
                question.questionText,
                question.optionA,
                question.optionB,
                question.optionC,
                question.optionD,
                String(question.id),
            ]
                .join(" ")
                .toLowerCase();

            return haystack.includes(normalizedSearch);
        });
    }, [difficultyFilter, searchTerm, sortedQuestions, topicFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));

    const paginatedQuestions = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredQuestions.slice(start, start + PAGE_SIZE);
    }, [currentPage, filteredQuestions]);

    const activeQuestion =
        editingQuestionId !== null
            ? sortedQuestions.find((q: QuestionRow) => q.id === editingQuestionId)
            : null;

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, topicFilter, difficultyFilter]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const resetForm = () => {
        setEditingQuestionId(null);
        setFormState(INITIAL_FORM_STATE);
    };

    const handleEdit = (id: number) => {
        const question = sortedQuestions.find((q: QuestionRow) => q.id === id);
        if (!question) return;

        setEditingQuestionId(question.id);
        setFormState({
            topic: question.topic,
            difficulty: question.difficulty,
            questionText: question.questionText,
            optionA: question.optionA,
            optionB: question.optionB,
            optionC: question.optionC,
            optionD: question.optionD,
            correctAnswer: question.correctAnswer,
            explanation: question.explanation ?? "",
        });
    };

    const handleDelete = async (id: number) => {
        const confirmed = window.confirm("Delete this question? This action cannot be undone.");
        if (!confirmed) return;

        await deleteQuestionMutation.mutateAsync({ id });
    };

    const setField = <K extends keyof QuestionFormState>(
        key: K,
        value: QuestionFormState[K]
    ) => {
        setFormState((prev: QuestionFormState) => ({ ...prev, [key]: value }));
    };

    const handleTextInputChange = (key: keyof QuestionFormState) => {
        return (event: any) => {
            setField(key, event.target.value as never);
        };
    };

    const handleDifficultyChange = (event: any) => {
        setField("difficulty", event.target.value as "easy" | "medium" | "hard");
    };

    const handleCorrectAnswerChange = (event: any) => {
        setField("correctAnswer", event.target.value as "A" | "B" | "C" | "D");
    };

    const handleSubmit = async (event: any) => {
        event.preventDefault();

        const payload = {
            topic: formState.topic.trim(),
            difficulty: formState.difficulty,
            questionText: formState.questionText.trim(),
            optionA: formState.optionA.trim(),
            optionB: formState.optionB.trim(),
            optionC: formState.optionC.trim(),
            optionD: formState.optionD.trim(),
            correctAnswer: formState.correctAnswer,
            explanation: formState.explanation.trim() || undefined,
        };

        if (editingQuestionId === null) {
            await createQuestionMutation.mutateAsync(payload);
            return;
        }

        await updateQuestionMutation.mutateAsync({
            id: editingQuestionId,
            data: payload,
        });
    };

    const parseImportedFile = async (file: File): Promise<ImportPreview> => {
        const content = await file.text();
        const fileName = file.name.toLowerCase();
        const existingKeys = new Set<string>(
            sortedQuestions.map((question: QuestionRow) =>
                buildQuestionDuplicateKey({
                    subject: question.subject,
                    topic: question.topic,
                    questionText: question.questionText,
                })
            )
        );

        if (fileName.endsWith(".json")) {
            let parsed: unknown;
            try {
                parsed = JSON.parse(content);
            } catch {
                throw new Error("Invalid JSON file.");
            }

            if (!Array.isArray(parsed)) {
                throw new Error("JSON import must be an array of question objects.");
            }

            const preview = normalizeImportRows(parsed as Record<string, unknown>[], existingKeys);
            return {
                ...preview,
                sourceName: file.name,
            };
        }

        if (fileName.endsWith(".csv")) {
            const lines = content
                .split(/\r?\n/)
                .map(line => line.trim())
                .filter(Boolean);

            if (lines.length < 2) {
                throw new Error("CSV file must include a header row and at least one data row.");
            }

            const header = parseCsvLine(lines[0]);
            const headerMap = header.reduce<Record<string, number>>((acc, key, idx) => {
                acc[key.trim()] = idx;
                return acc;
            }, {});

            const requiredHeaders = [
                "topic",
                "difficulty",
                "questionText",
                "optionA",
                "optionB",
                "optionC",
                "optionD",
                "correctAnswer",
            ];

            for (const key of requiredHeaders) {
                if (!(key in headerMap)) {
                    throw new Error(`CSV missing required header: ${key}`);
                }
            }

            const rawRows = lines.slice(1).map(line => {
                const cells = parseCsvLine(line);
                const get = (key: string) => {
                    const index = headerMap[key];
                    return index === undefined ? "" : cells[index] ?? "";
                };

                return {
                    topic: get("topic"),
                    difficulty: get("difficulty"),
                    questionText: get("questionText"),
                    optionA: get("optionA"),
                    optionB: get("optionB"),
                    optionC: get("optionC"),
                    optionD: get("optionD"),
                    correctAnswer: get("correctAnswer"),
                    explanation: get("explanation"),
                } as Record<string, unknown>;
            });

            const preview = normalizeImportRows(rawRows, existingKeys);
            return {
                ...preview,
                sourceName: file.name,
            };
        }

        throw new Error("Unsupported file type. Upload .json or .csv");
    };

    const handleImportFile = async (event: any) => {
        const file = event.target.files?.[0] as File | undefined;
        if (!file) return;

        setImportError(null);
        setImportPreview(null);
        setImportSummary(null);

        try {
            const preview = await parseImportedFile(file);
            setImportPreview(preview);
            if (preview.errors.length > 0) {
                setImportError("Some rows are invalid. Fix and re-upload before import.");
            }
        } catch (error) {
            setImportError(error instanceof Error ? error.message : "Failed to parse import file.");
        }
    };

    const handleConfirmImport = async () => {
        if (!importPreview || importPreview.rows.length === 0 || importPreview.errors.length > 0) {
            return;
        }

        await bulkCreateMutation.mutateAsync(importPreview.rows);
    };

    const handleManagerFieldChange = (key: keyof ManagerFormState) => {
        return (event: any) => {
            setManagerForm((prev: ManagerFormState) => ({
                ...prev,
                [key]: event.target.value,
            }));
        };
    };

    const handleCreateManagerAccount = async (event: any) => {
        event.preventDefault();
        setManagerCreateMessage(null);

        await createManagerMutation.mutateAsync({
            name: managerForm.name.trim(),
            email: managerForm.email.trim(),
            openId: managerForm.openId.trim() || undefined,
        });
    };

    const handleExamFieldChange = (key: keyof ExamFormState) => {
        return (event: any) => {
            const value = key === "duration" || key === "showResultsAfterSubmission" || key === "shuffleQuestionsPerUser"
                ? (key === "duration" ? parseInt(event.target.value) || 0 : event.target.checked)
                : event.target.value;
            setExamForm((prev: ExamFormState) => ({
                ...prev,
                [key]: value,
            }));
        };
    };

    const handleAddQuestion = (questionId: number) => {
        setSelectedQuestionIds((prev) => {
            if (prev.includes(questionId)) {
                return prev.filter(id => id !== questionId);
            }
            return [...prev, questionId];
        });
        setExamForm((prev) => ({
            ...prev,
            questionIds: selectedQuestionIds.includes(questionId)
                ? selectedQuestionIds.filter(id => id !== questionId)
                : [...selectedQuestionIds, questionId],
        }));
    };

    const handleAddSubject = (subject: string) => {
        const isSelected = examForm.subjects.some(s => s.subject === subject);

        if (isSelected) {
            // Remove subject
            setExamForm((prev) => ({
                ...prev,
                subjects: prev.subjects.filter(s => s.subject !== subject),
            }));
        } else {
            // Prompt for count
            const count = prompt(`How many questions from ${subject}?`, "10");
            if (count && !isNaN(Number(count)) && Number(count) > 0) {
                setExamForm((prev) => ({
                    ...prev,
                    subjects: [...prev.subjects, { subject, count: Number(count) }],
                }));
            }
        }
    };

    const handleUpdateSubjectCount = (subject: string, count: number) => {
        setExamForm((prev) => ({
            ...prev,
            subjects: prev.subjects.map(s =>
                s.subject === subject ? { ...s, count } : s
            ),
        }));
    };

    const handleAddGroup = () => {
        const newGroup = {
            id: `group_${Date.now()}`,
            name: `Group ${examForm.groups.length + 1}`,
        };
        setExamForm((prev) => ({
            ...prev,
            groups: [...prev.groups, newGroup],
        }));
    };

    const handleRemoveGroup = (groupId: string) => {
        setExamForm((prev) => ({
            ...prev,
            groups: prev.groups.filter(g => g.id !== groupId),
        }));
    };

    const handleSubmitExam = async (event: any) => {
        event.preventDefault();

        if (examForm.subjects.length === 0 && examForm.questionIds.length === 0) {
            alert("Please select at least one subject or question");
            return;
        }

        const payload = {
            name: examForm.name.trim(),
            description: examForm.description.trim() || undefined,
            duration: examForm.duration,
            availableAt: new Date(examForm.availableAt),
            questionIds: examForm.questionIds,
            subjectCounts: examForm.subjects,
            groups: examForm.groups.length > 0 ? examForm.groups : undefined,
            shuffleQuestionsPerUser: examForm.shuffleQuestionsPerUser,
            showResultsAfterSubmission: examForm.showResultsAfterSubmission,
        };

        if (editingExamId === null) {
            await createExamMutation.mutateAsync(payload as any);
        } else {
            await updateExamMutation.mutateAsync({
                id: editingExamId,
                ...payload,
            } as any);
        }
    };

    const handleEditExam = (exam: ExamRow) => {
        setEditingExamId(exam.id);
        setExamForm({
            name: exam.name,
            description: exam.description || "",
            duration: exam.duration,
            availableAt: new Date(exam.availableAt).toISOString().slice(0, 16),
            subjects: exam.subjectCounts,
            questionIds: exam.questionIds,
            groups: exam.groups,
            shuffleQuestionsPerUser: exam.shuffleQuestionsPerUser,
            showResultsAfterSubmission: exam.showResultsAfterSubmission,
        });
        setSelectedQuestionIds(exam.questionIds);
    };

    const handleDeleteExam = async (id: number) => {
        if (window.confirm("Delete this exam? This action cannot be undone.")) {
            await deleteExamMutation.mutateAsync({ id });
        }
    };

    const resetExamForm = () => {
        setExamForm(INITIAL_EXAM_FORM_STATE);
        setSelectedQuestionIds([]);
        setEditingExamId(null);
    };

    const downloadTemplate = (type: "json" | "csv") => {
        const exampleRow: ImportQuestion = {
            subject: "Mathematics",
            topic: "Algebra",
            difficulty: "medium",
            questionText: "If 2x + 5 = 15, what is x?",
            optionA: "3",
            optionB: "4",
            optionC: "5",
            optionD: "6",
            correctAnswer: "C",
            explanation: "2x = 10, so x = 5",
        };

        let content = "";
        let fileName = "";
        let mimeType = "";

        if (type === "json") {
            content = JSON.stringify([exampleRow], null, 2);
            fileName = "questions-template.json";
            mimeType = "application/json";
        } else {
            content = [
                "subject,topic,difficulty,questionText,optionA,optionB,optionC,optionD,correctAnswer,explanation",
                'Mathematics,Algebra,medium,"If 2x + 5 = 15, what is x?",3,4,5,6,C,"2x = 10, so x = 5"',
            ].join("\n");
            fileName = "questions-template.csv";
            mimeType = "text/csv";
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const downloadImportErrors = () => {
        if (!importPreview || importPreview.errors.length === 0) return;

        const lines = [
            "row,error",
            ...importPreview.errors.map((message: string, index: number) => {
                const escaped = message.replaceAll('"', '""');
                return `${index + 1},"${escaped}"`;
            }),
        ];

        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `import-errors-${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (user.role !== "admin") {
        return (
            <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
                <div className="max-w-lg w-full rounded-xl border border-border bg-card/80 p-8 text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
                        <Shield className="h-6 w-6 text-orange-400" />
                    </div>
                    <h1 className="text-2xl font-bold text-white">Admin access required</h1>
                    <p className="mt-3 text-sm text-muted-foreground">
                        This area is restricted to administrator accounts.
                    </p>
                    <Button
                        className="mt-6"
                        onClick={() => setLocation("/")}
                    >
                        Return to Home
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout>
            <div className="space-y-6 max-w-7xl">
                <div className="rounded-xl border border-border bg-card/80 p-6">
                    <h1 className="text-2xl font-bold text-white">Admin Question Management</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Welcome, {user.name || "Admin"}. Create, edit, and remove questions from the bank.
                    </p>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                    <div className="xl:col-span-2 rounded-xl border border-border bg-card/80 p-6">
                        <h2 className="text-lg font-semibold text-white">
                            {editingQuestionId === null ? "Create Question" : `Edit Question #${editingQuestionId}`}
                        </h2>
                        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                            <input
                                value={formState.subject}
                                onChange={handleTextInputChange("subject")}
                                placeholder="Subject (e.g. Mathematics, English, Physics)"
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />

                            <input
                                value={formState.topic}
                                onChange={handleTextInputChange("topic")}
                                placeholder="Topic (e.g. Algebra)"
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />

                            <select
                                value={formState.difficulty}
                                onChange={handleDifficultyChange}
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                            >
                                <option value="easy">easy</option>
                                <option value="medium">medium</option>
                                <option value="hard">hard</option>
                            </select>

                            <textarea
                                value={formState.questionText}
                                onChange={handleTextInputChange("questionText")}
                                placeholder="Question text"
                                className="w-full min-h-24 rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />

                            <input
                                value={formState.optionA}
                                onChange={handleTextInputChange("optionA")}
                                placeholder="Option A"
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />
                            <input
                                value={formState.optionB}
                                onChange={handleTextInputChange("optionB")}
                                placeholder="Option B"
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />
                            <input
                                value={formState.optionC}
                                onChange={handleTextInputChange("optionC")}
                                placeholder="Option C"
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />
                            <input
                                value={formState.optionD}
                                onChange={handleTextInputChange("optionD")}
                                placeholder="Option D"
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />

                            <select
                                value={formState.correctAnswer}
                                onChange={handleCorrectAnswerChange}
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                            >
                                <option value="A">Correct Answer: A</option>
                                <option value="B">Correct Answer: B</option>
                                <option value="C">Correct Answer: C</option>
                                <option value="D">Correct Answer: D</option>
                            </select>

                            <textarea
                                value={formState.explanation}
                                onChange={handleTextInputChange("explanation")}
                                placeholder="Explanation (optional)"
                                className="w-full min-h-20 rounded-md border border-border bg-input px-3 py-2 text-sm"
                            />

                            <div className="flex gap-2 pt-2">
                                <Button type="submit" disabled={isSaving} className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
                                    <Plus className="mr-2 h-4 w-4" />
                                    {editingQuestionId === null ? "Create" : "Update"}
                                </Button>
                                {editingQuestionId !== null && (
                                    <Button type="button" variant="outline" onClick={resetForm}>
                                        Cancel Edit
                                    </Button>
                                )}
                            </div>
                        </form>
                    </div>

                    <div className="xl:col-span-3 rounded-xl border border-border bg-card/80 p-6">
                        <h2 className="text-lg font-semibold text-white">Question Bank</h2>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {filteredQuestions.length} of {sortedQuestions.length} questions shown
                        </p>

                        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                            <input
                                value={searchTerm}
                                onChange={(event: any) => setSearchTerm(event.target.value)}
                                placeholder="Search by ID, topic, or question text"
                                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm md:col-span-2"
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <select
                                    value={topicFilter}
                                    onChange={(event: any) => setTopicFilter(event.target.value)}
                                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                >
                                    <option value="all">All topics</option>
                                    {topicOptions.map(topic => (
                                        <option key={topic} value={topic}>
                                            {topic}
                                        </option>
                                    ))}
                                </select>

                                <select
                                    value={difficultyFilter}
                                    onChange={(event: any) =>
                                        setDifficultyFilter(event.target.value as "all" | "easy" | "medium" | "hard")
                                    }
                                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                >
                                    <option value="all">All levels</option>
                                    <option value="easy">easy</option>
                                    <option value="medium">medium</option>
                                    <option value="hard">hard</option>
                                </select>
                            </div>
                        </div>

                        {questionsQuery.isLoading && (
                            <p className="mt-4 text-sm text-muted-foreground">Loading questions...</p>
                        )}

                        {questionsQuery.error && (
                            <p className="mt-4 text-sm text-red-400">Failed to load questions.</p>
                        )}

                        {!questionsQuery.isLoading && !questionsQuery.error && (
                            <div className="mt-4 max-h-[70vh] overflow-auto rounded-lg border border-border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/30 sticky top-0">
                                        <tr>
                                            <th className="text-left px-3 py-2">ID</th>
                                            <th className="text-left px-3 py-2">Topic</th>
                                            <th className="text-left px-3 py-2">Difficulty</th>
                                            <th className="text-left px-3 py-2">Question</th>
                                            <th className="text-left px-3 py-2">Correct</th>
                                            <th className="text-left px-3 py-2">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedQuestions.map(question => (
                                            <tr key={question.id} className="border-t border-border/60 align-top">
                                                <td className="px-3 py-2">{question.id}</td>
                                                <td className="px-3 py-2">{question.topic}</td>
                                                <td className="px-3 py-2">{question.difficulty}</td>
                                                <td className="px-3 py-2 max-w-md">
                                                    <div className="line-clamp-3 text-muted-foreground">{question.questionText}</div>
                                                </td>
                                                <td className="px-3 py-2">{question.correctAnswer}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleEdit(question.id)}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-red-300"
                                                            disabled={deleteQuestionMutation.isPending}
                                                            onClick={() => handleDelete(question.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {paginatedQuestions.length === 0 && (
                                            <tr>
                                                <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                                                    No questions match the current filters.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {!questionsQuery.isLoading && !questionsQuery.error && filteredQuestions.length > 0 && (
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">
                                    Page {currentPage} of {totalPages}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage <= 1}
                                        onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card/80 p-6">
                    <h2 className="text-lg font-semibold text-white">Manager Management</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Create and manage dedicated manager accounts.
                    </p>

                    {user.loginMethod === "manager" ? (
                        <p className="mt-4 text-sm text-yellow-400">
                            Managers cannot create or manage other manager accounts. Contact your administrator.
                        </p>
                    ) : (
                        <>
                            <form className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4" onSubmit={handleCreateManagerAccount}>
                                <input
                                    value={managerForm.name}
                                    onChange={handleManagerFieldChange("name")}
                                    placeholder="Manager name"
                                    className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                                    required
                                />
                                <input
                                    value={managerForm.email}
                                    onChange={handleManagerFieldChange("email")}
                                    placeholder="manager@school.com"
                                    className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                                    type="email"
                                    required
                                />
                                <input
                                    value={managerForm.openId}
                                    onChange={handleManagerFieldChange("openId")}
                                    placeholder="Optional OpenID"
                                    className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                                />
                                <Button type="submit" disabled={createManagerMutation.isPending}>
                                    Create Manager
                                </Button>
                            </form>

                            {createManagerMutation.error && (
                                <p className="mt-3 text-sm text-red-400">Failed to create manager account.</p>
                            )}

                            {managerCreateMessage && (
                                <p className="mt-3 text-sm text-cyan-300">{managerCreateMessage}</p>
                            )}
                        </>
                    )}

                    {usersQuery.isLoading && (
                        <p className="mt-4 text-sm text-muted-foreground">Loading managers...</p>
                    )}

                    {usersQuery.error && (
                        <p className="mt-4 text-sm text-red-400">Failed to load managers.</p>
                    )}

                    {!usersQuery.isLoading && !usersQuery.error && (
                        <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted/30">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Name</th>
                                        <th className="px-3 py-2 text-left">Email</th>
                                        <th className="px-3 py-2 text-left">OpenID</th>
                                        <th className="px-3 py-2 text-left">Last sign in</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(usersQuery.data as UserRow[] | undefined)
                                        ?.filter(a => a.role === "admin" && a.loginMethod === "manager")
                                        .map((account: UserRow) => (
                                            <tr key={account.id} className="border-t border-border/60">
                                                <td className="px-3 py-2">{account.name || "-"}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{account.email || "-"}</td>
                                                <td className="px-3 py-2 font-mono text-xs text-cyan-400">{account.openId}</td>
                                                <td className="px-3 py-2 text-muted-foreground">
                                                    {account.lastSignedIn
                                                        ? new Date(account.lastSignedIn).toLocaleString()
                                                        : "-"}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-border bg-card/80 p-6">
                    <h2 className="text-lg font-semibold text-white">Users</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        All registered users and their account details.
                    </p>

                    {usersQuery.isLoading && (
                        <p className="mt-4 text-sm text-muted-foreground">Loading users...</p>
                    )}

                    {usersQuery.error && (
                        <p className="mt-4 text-sm text-red-400">Failed to load users.</p>
                    )}

                    {!usersQuery.isLoading && !usersQuery.error && (
                        <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted/30">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Name</th>
                                        <th className="px-3 py-2 text-left">Email</th>
                                        <th className="px-3 py-2 text-left">Login Method</th>
                                        <th className="px-3 py-2 text-left">Last sign in</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(usersQuery.data as UserRow[] | undefined)
                                        ?.filter(a => a.role === "user")
                                        .map((account: UserRow) => (
                                            <tr key={account.id} className="border-t border-border/60">
                                                <td className="px-3 py-2">{account.name || "-"}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{account.email || "-"}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{account.loginMethod || "-"}</td>
                                                <td className="px-3 py-2 text-muted-foreground">
                                                    {account.lastSignedIn
                                                        ? new Date(account.lastSignedIn).toLocaleString()
                                                        : "-"}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-border bg-card/80 p-6">
                    <h2 className="text-lg font-semibold text-white">Bulk Import (JSON/CSV)</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Required fields: topic, difficulty, questionText, optionA, optionB, optionC, optionD, correctAnswer. Optional: explanation.
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" onClick={() => downloadTemplate("json")}>
                            <Download className="mr-2 h-4 w-4" />
                            JSON Template
                        </Button>
                        <Button type="button" variant="outline" onClick={() => downloadTemplate("csv")}>
                            <Download className="mr-2 h-4 w-4" />
                            CSV Template
                        </Button>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                            <FileUp className="h-4 w-4" />
                            Upload file
                            <input
                                type="file"
                                accept=".json,.csv"
                                className="hidden"
                                onChange={handleImportFile}
                            />
                        </label>
                        <Button
                            type="button"
                            disabled={
                                !importPreview ||
                                importPreview.rows.length === 0 ||
                                importPreview.errors.length > 0 ||
                                bulkCreateMutation.isPending
                            }
                            onClick={handleConfirmImport}
                        >
                            Import {importPreview?.rows.length ?? 0} Rows
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setImportPreview(null);
                                setImportError(null);
                                setImportSummary(null);
                            }}
                        >
                            Clear Preview
                        </Button>
                        <Button onClick={() => setLocation("/")} variant="outline">
                            Back to Main Site
                        </Button>
                    </div>

                    {importError && (
                        <p className="mt-3 text-sm text-red-400">{importError}</p>
                    )}

                    {importSummary && (
                        <p className="mt-3 text-sm text-cyan-300">
                            Import complete: {importSummary.createdCount} created, {importSummary.skippedCount} skipped as duplicates.
                        </p>
                    )}

                    {importPreview && (
                        <div className="mt-4 space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Preview from {importPreview.sourceName}: {importPreview.rows.length} valid rows, {importPreview.errors.length} errors.
                            </p>

                            {importPreview.errors.length > 0 && (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={downloadImportErrors}
                                    >
                                        <Download className="mr-2 h-4 w-4" />
                                        Export Errors
                                    </Button>
                                    <div className="max-h-32 overflow-auto rounded-md border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                                        {importPreview.errors.map((message, index) => (
                                            <p key={`${message}-${index}`}>{message}</p>
                                        ))}
                                    </div>
                                </>
                            )}

                            {importPreview.rows.length > 0 && (
                                <div className="max-h-56 overflow-auto rounded-md border border-border">
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-muted/40">
                                            <tr>
                                                <th className="px-2 py-2 text-left">Topic</th>
                                                <th className="px-2 py-2 text-left">Difficulty</th>
                                                <th className="px-2 py-2 text-left">Question</th>
                                                <th className="px-2 py-2 text-left">Correct</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {importPreview.rows.slice(0, 50).map((row, index) => (
                                                <tr key={`${row.topic}-${index}`} className="border-t border-border/60">
                                                    <td className="px-2 py-2">{row.topic}</td>
                                                    <td className="px-2 py-2">{row.difficulty}</td>
                                                    <td className="px-2 py-2 text-muted-foreground line-clamp-2">{row.questionText}</td>
                                                    <td className="px-2 py-2">{row.correctAnswer}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="rounded-xl border border-border bg-card/80 p-6">
                    <h2 className="text-lg font-semibold text-white">Exam Management</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Create and manage exams that users can take.
                    </p>

                    <form className="mt-4 space-y-4" onSubmit={handleSubmitExam}>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <input
                                value={examForm.name}
                                onChange={handleExamFieldChange("name")}
                                placeholder="Exam name"
                                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                                required
                            />
                            <input
                                value={examForm.description}
                                onChange={handleExamFieldChange("description")}
                                placeholder="Description (optional)"
                                className="rounded-md border border-border bg-input px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div>
                                <label className="text-xs text-muted-foreground">Duration (minutes)</label>
                                <input
                                    type="number"
                                    value={examForm.duration}
                                    onChange={handleExamFieldChange("duration")}
                                    min="1"
                                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Available at</label>
                                <input
                                    type="datetime-local"
                                    value={examForm.availableAt}
                                    onChange={handleExamFieldChange("availableAt")}
                                    className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm"
                                    required
                                />
                            </div>
                            <div className="flex items-end">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={examForm.shuffleQuestionsPerUser}
                                            onChange={handleExamFieldChange("shuffleQuestionsPerUser")}
                                            className="rounded border-border"
                                        />
                                        <span className="text-sm">Shuffle questions per user</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={examForm.showResultsAfterSubmission}
                                            onChange={handleExamFieldChange("showResultsAfterSubmission")}
                                            className="rounded border-border"
                                        />
                                        <span className="text-sm">Show results after submission</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Subjects ({examForm.subjects.length} selected)</label>
                            <div className="space-y-3">
                                <div className="max-h-40 overflow-y-auto border border-border rounded-md p-3 space-y-2">
                                    {!subjectsQuery.data || (subjectsQuery.data as string[]).length === 0 ? (
                                        <p className="text-xs text-muted-foreground">No subjects available</p>
                                    ) : (
                                        (subjectsQuery.data as string[]).map((subject) => (
                                            <div key={subject} className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={examForm.subjects.some(s => s.subject === subject)}
                                                    onChange={() => handleAddSubject(subject)}
                                                    className="rounded border-border"
                                                />
                                                <span className="text-xs text-muted-foreground">
                                                    {subject}
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {examForm.subjects.length > 0 && (
                                    <div className="border border-border rounded-md p-3 bg-background/50 space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground block">Questions per subject:</label>
                                        {examForm.subjects.map((item) => (
                                            <div key={item.subject} className="flex items-center gap-2">
                                                <span className="text-xs text-muted-foreground flex-1">{item.subject}</span>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={item.count}
                                                    onChange={(e) => handleUpdateSubjectCount(item.subject, Number(e.target.value))}
                                                    className="w-16 px-2 py-1 text-xs rounded border border-border bg-input"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Questions ({examForm.questionIds.length} selected) - Optional</label>
                            <div className="max-h-48 overflow-y-auto border border-border rounded-md p-3 space-y-2">
                                <p className="text-xs text-muted-foreground mb-2">Select specific questions (or leave empty to use subjects above)</p>
                                {sortedQuestions.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No questions available</p>
                                ) : (
                                    sortedQuestions.map((q) => (
                                        <div key={q.id} className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={examForm.questionIds.includes(q.id)}
                                                onChange={() => handleAddQuestion(q.id)}
                                                className="rounded border-border"
                                            />
                                            <span className="text-xs text-muted-foreground">
                                                Q{q.id} - {q.subject} → {q.topic} ({q.difficulty})
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium">Groups</label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleAddGroup}
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Group
                                </Button>
                            </div>
                            {examForm.groups.length === 0 ? (
                                <p className="text-xs text-muted-foreground">No groups added yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {examForm.groups.map((group) => (
                                        <div key={group.id} className="flex items-center gap-2 p-2 border border-border rounded-md">
                                            <input
                                                type="text"
                                                value={group.name}
                                                className="flex-1 rounded-md border border-border bg-input px-2 py-1 text-xs"
                                                readOnly
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleRemoveGroup(group.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 pt-2">
                            <Button type="submit" disabled={createExamMutation.isPending || updateExamMutation.isPending} className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white">
                                <Plus className="mr-2 h-4 w-4" />
                                {editingExamId === null ? "Create Exam" : "Update Exam"}
                            </Button>
                            {editingExamId !== null && (
                                <Button type="button" variant="outline" onClick={resetExamForm}>
                                    Cancel Edit
                                </Button>
                            )}
                        </div>
                    </form>

                    {(createExamMutation.error || updateExamMutation.error) && (
                        <p className="mt-3 text-sm text-red-400">Failed to save exam.</p>
                    )}

                    {examsQuery.isLoading && (
                        <p className="mt-4 text-sm text-muted-foreground">Loading exams...</p>
                    )}

                    {examsQuery.error && (
                        <p className="mt-4 text-sm text-red-400">Failed to load exams.</p>
                    )}

                    {!examsQuery.isLoading && !examsQuery.error && (
                        <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-muted/30">
                                    <tr>
                                        <th className="px-3 py-2 text-left">Name</th>
                                        <th className="px-3 py-2 text-left">Duration</th>
                                        <th className="px-3 py-2 text-left">Questions</th>
                                        <th className="px-3 py-2 text-left">Subjects</th>
                                        <th className="px-3 py-2 text-left">Shuffle</th>
                                        <th className="px-3 py-2 text-left">Groups</th>
                                        <th className="px-3 py-2 text-left">Available at</th>
                                        <th className="px-3 py-2 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(examsQuery.data as ExamRow[] | undefined)?.map((exam: ExamRow) => (
                                        <tr key={exam.id} className="border-t border-border/60">
                                            <td className="px-3 py-2">{exam.name}</td>
                                            <td className="px-3 py-2">{exam.duration} min</td>
                                            <td className="px-3 py-2 font-semibold text-cyan-400">
                                                {exam.questionIds.length + (exam.subjectCounts?.reduce((sum, s) => sum + s.count, 0) ?? 0)}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground text-xs">
                                                {new Date(exam.availableAt).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                {exam.subjectCounts && exam.subjectCounts.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {exam.subjectCounts.map((s, i) => (
                                                            <span 
                                                                key={i}
                                                                className="inline-block px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded text-xs"
                                                            >
                                                                {s.subject.substring(0, 3)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                {exam.shuffleQuestionsPerUser ? (
                                                    <span className="text-green-400">✓ On</span>
                                                ) : (
                                                    <span className="text-orange-400">Fixed</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-xs">
                                                {exam.groups && exam.groups.length > 0 ? (
                                                    <span className="text-amber-300">{exam.groups.length}</span>
                                                ) : (
                                                    <span className="text-muted-foreground">Public</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-muted-foreground text-xs">
                                                {new Date(exam.availableAt).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2">
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleEditExam(exam)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-300"
                                                        disabled={deleteExamMutation.isPending}
                                                        onClick={() => handleDeleteExam(exam.id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
