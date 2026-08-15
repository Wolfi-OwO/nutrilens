import { useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router';
import { Camera, Check, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePhotoPrediction } from '@/hooks/use-photo-prediction';
import { useCreateMealLog } from '@/hooks/use-meal-logs';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Skeleton } from "@/components/ui/skeleton";
import type { MealLogSource, PhotoPrediction } from '@/types/api';

const itemSchema = z.object({
    foodName: z.string().min(1, 'Required'),
    portionGrams: z.coerce.number<number>().positive('Must be greater than 0'),
    calories: z.coerce.number<number>().min(0, 'Must be 0 or more'),
    proteinGrams: z.coerce.number<number>().min(0).optional(),
    carbGrams: z.coerce.number<number>().min(0).optional(),
    fatGrams: z.coerce.number<number>().min(0).optional(),
});

const formSchema = z.object({ items: z.array(itemSchema).min(1) });
type FormValues = z.infer<typeof formSchema>;

const EMPTY_ITEM = { foodName: '', portionGrams: 0, calories: 0 };

function formatLabel(label: string): string {
    return label.replaceAll('_', ' ');
}

type Stage = 'idle' | 'analyzing' | 'reviewing';

export default function LogMealPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stage, setStage] = useState<Stage>('idle');
    const [source, setSource] = useState<MealLogSource>('manual_search');
    const [predictions, setPredictions] = useState<PhotoPrediction[] | null>(null);
    const [predictionsLowConfidence, setPredictionsLowConfidence] = useState(false);
    const [aiUnavailableReason, setAiUnavailableReason] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [needsPlan, setNeedsPlan] = useState(false);

    const photoPrediction = usePhotoPrediction();
    const createMealLog = useCreateMealLog();

    const {
        control,
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: { items: [EMPTY_ITEM] },
    });
    const { fields, append, remove } = useFieldArray({ control, name: 'items' });

    const startManualEntry = () => {
        setSource('manual_search');
        setPredictions(null);
        setPredictionsLowConfidence(false);
        setAiUnavailableReason(null);
        reset({ items: [EMPTY_ITEM] });
        setStage('reviewing');
    };

    const handlePhotoSelected = async (file: File) => {
        setStage('analyzing');
        setSubmitError(null);
        try {
            const result = await photoPrediction.mutateAsync(file);
            setSource('ai_photo');

            if (result.available && result.predictions && result.predictions.length > 0) {
                setPredictions(result.predictions);
                setPredictionsLowConfidence(result.isConfident === false);
                setAiUnavailableReason(null);
                reset({
                    items: [
                        {
                            ...EMPTY_ITEM,
                            foodName: formatLabel(result.predictions[0]?.label ?? ''),
                        },
                    ],
                });
            } else {
                // The graceful fallback from ADR-0003: the AI path didn't work this
                // time, so land on the same manual item form rather than a dead end.
                setPredictions(null);
                setPredictionsLowConfidence(false);
                setAiUnavailableReason(
                    "Couldn't identify this photo automatically — enter what you ate below.",
                );
                reset({ items: [EMPTY_ITEM] });
            }
            setStage('reviewing');
        } catch {
            setPredictions(null);
            setPredictionsLowConfidence(false);
            setAiUnavailableReason("Couldn't reach the AI service — enter what you ate below.");
            reset({ items: [EMPTY_ITEM] });
            setStage('reviewing');
        }
    };

    const applyPrediction = (label: string) => {
        reset({ items: [{ ...EMPTY_ITEM, foodName: formatLabel(label) }] });
    };

    const onSubmit = async (values: FormValues) => {
        setSubmitError(null);
        setNeedsPlan(false);
        try {
            await createMealLog.mutateAsync({ source, items: values.items });
            void navigate('/');
        } catch (error) {
            if (error instanceof ApiError && error.status === 409) {
                setSubmitError('You need an active diet plan before logging a meal.');
                setNeedsPlan(true);
            } else {
                setSubmitError('Something went wrong saving this meal. Please try again.');
            }
        }
    };
    const renderAnalyzingStage = () => {
        return (
            <Card>
                <CardContent className="py-6">
                    <div className="mb-4">
                        <Skeleton className="h-4 w-24 mb-2" />
                    </div>
                    <div className="space-y-4">
                        <div className="flex flex-col gap-1.5">
                            <Skeleton className="h-4 w-24" />
                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-4 w-16" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <Skeleton className="h-4 w-16" />
                                </div>
                            </div>
                        </div>
                        <Button className="w-fit gap-2 text-muted-foreground" aria-disabled="true">
                            <Plus size={16} strokeWidth={2} />
                            Add another item
                        </Button>
                    </div>
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="font-display text-2xl font-bold text-foreground">Log a meal</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    A photo goes to the AI-detection server for analysis.
                </p>
            </div>

            {stage === 'idle' && (
                <div className="flex flex-col gap-4">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handlePhotoSelected(file);
                            event.target.value = '';
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-card p-10 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-secondary/40"
                    >
                        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-secondary-foreground">
                            <Camera size={24} strokeWidth={1.75} />
                        </span>
                        <span className="font-medium text-foreground">Take or upload a photo</span>
                    </button>
                    <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
                        <span className="h-px flex-1 bg-border" />
                        or
                        <span className="h-px flex-1 bg-border" />
                    </div>
                    <Button variant="outline" onClick={startManualEntry} className="gap-2">
                        <Search size={16} strokeWidth={2} />
                        Enter it manually
                    </Button>
                </div>
            )}

            {stage === 'analyzing' && renderAnalyzingStage()}

            {stage === 'reviewing' && (
                <form
                    onSubmit={(e) => void handleSubmit(onSubmit)(e)}
                    className="flex flex-col gap-4"
                    noValidate
                >
                    {predictions && (
                        <Card>
                            <CardContent className="pt-6">
                                <h2 className="font-display text-base font-bold text-foreground">
                                    AI prediction — tap to use
                                </h2>
                                {predictionsLowConfidence && (
                                    <p className="mb-3 mt-1 text-sm text-muted-foreground">
                                        Not very confident about this one — double check before
                                        confirming.
                                    </p>
                                )}
                                <ul
                                    className={cn(
                                        'flex flex-wrap gap-2',
                                        !predictionsLowConfidence && 'mt-3',
                                    )}
                                >
                                    {predictions.map((prediction) => (
                                        <li key={prediction.label}>
                                            <button
                                                type="button"
                                                onClick={() => applyPrediction(prediction.label)}
                                                className={cn(
                                                    'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted',
                                                )}
                                            >
                                                {formatLabel(prediction.label)}
                                                <span className="rounded-full bg-secondary px-1.5 py-0.5 font-mono text-xs tabular-nums text-secondary-foreground">
                                                    {Math.round(prediction.confidence * 100)}%
                                                </span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    {aiUnavailableReason && (
                        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                            {aiUnavailableReason}
                        </p>
                    )}

                    <Card>
                        <CardContent className="flex flex-col gap-5 pt-6">
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="flex flex-col gap-3 border-b border-border pb-5 last:border-0 last:pb-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor={`items.${index}.foodName`}>Food</Label>
                                        {fields.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => remove(index)}
                                                className="-m-2.5 flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-destructive"
                                                aria-label="Remove item"
                                            >
                                                <Trash2 size={16} strokeWidth={2} />
                                            </button>
                                        )}
                                    </div>
                                    <Input
                                        id={`items.${index}.foodName`}
                                        placeholder="Grilled chicken salad"
                                        aria-invalid={!!errors.items?.[index]?.foodName}
                                        {...register(`items.${index}.foodName`)}
                                    />
                                    {errors.items?.[index]?.foodName && (
                                        <p className="text-sm text-destructive">
                                            {errors.items[index]?.foodName?.message}
                                        </p>
                                    )}

                                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.portionGrams`}>
                                                Portion (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.portionGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                aria-invalid={!!errors.items?.[index]?.portionGrams}
                                                {...register(`items.${index}.portionGrams`)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.calories`}>
                                                Calories
                                            </Label>
                                            <Input
                                                id={`items.${index}.calories`}
                                                type="number"
                                                inputMode="decimal"
                                                aria-invalid={!!errors.items?.[index]?.calories}
                                                {...register(`items.${index}.calories`)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.proteinGrams`}>
                                                Protein (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.proteinGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                {...register(`items.${index}.proteinGrams`)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.carbGrams`}>
                                                Carbs (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.carbGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                {...register(`items.${index}.carbGrams`)}
                                            />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <Label htmlFor={`items.${index}.fatGrams`}>
                                                Fat (g)
                                            </Label>
                                            <Input
                                                id={`items.${index}.fatGrams`}
                                                type="number"
                                                inputMode="decimal"
                                                {...register(`items.${index}.fatGrams`)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button
                                type="button"
                                variant="ghost"
                                className="w-fit gap-2 text-muted-foreground"
                                onClick={() => {
                                    append(EMPTY_ITEM);
                                }}
                            >
                                <Plus size={16} strokeWidth={2} />
                                Add another item
                            </Button>
                        </CardContent>
                    </Card>

                    {submitError && (
                        <p
                            role="alert"
                            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        >
                            {submitError}
                            {needsPlan && (
                                <>
                                    {' '}
                                    <Link
                                        to="/plan"
                                        className="font-medium underline underline-offset-2"
                                    >
                                        Set up a plan
                                    </Link>
                                    .
                                </>
                            )}
                        </p>
                    )}

                    <div className="flex gap-3">
                        <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                            <Check size={16} strokeWidth={2.5} />
                            {isSubmitting ? 'Logging…' : 'Confirm & log'}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="flex-1"
                            onClick={() => {
                                setStage('idle');
                                setPredictions(null);
                                setPredictionsLowConfidence(false);
                                setAiUnavailableReason(null);
                            }}
                        >
                            Discard
                        </Button>
                    </div>
                </form>
            )}
        </div>
    );
}
