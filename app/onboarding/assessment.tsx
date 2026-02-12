import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getOnboardingAssessmentState,
  setOnboardingAssessmentState,
  setOnboardingComplete,
  setOnboardingRecommendedTechnique,
  setOnboardingStep,
  type TechniqueKey,
} from '../../lib/data/repositories/settingsRepo';

interface Question {
  id: string;
  text: string;
  options: {
    id: string;
    text: string;
    scores: Record<TechniqueKey, number>;
  }[];
}

type AssessmentScores = Record<TechniqueKey, number>;

const DEFAULT_SCORES: AssessmentScores = {
  BAT: 0,
  CC_DS: 0,
  LAT: 0,
};

const TECHNIQUE_PRIORITY: TechniqueKey[] = ['BAT', 'CC_DS', 'LAT'];

const QUESTIONS: Question[] = [
  {
    id: 'q1',
    text: 'What does your dog do when they see a trigger?',
    options: [
      { id: 'a', text: 'Stares intently, ears forward, tense body', scores: { LAT: 3, BAT: 2, CC_DS: 1 } },
      { id: 'b', text: 'Barks, lunges, tries to get closer', scores: { BAT: 3, CC_DS: 2, LAT: 1 } },
      { id: 'c', text: 'Hides, tries to run away, tail tucked', scores: { CC_DS: 3, BAT: 2, LAT: 1 } },
      { id: 'd', text: 'Mix of barking and trying to escape', scores: { BAT: 2, CC_DS: 2, LAT: 1 } },
    ],
  },
  {
    id: 'q2',
    text: 'At what distance does your dog first notice triggers?',
    options: [
      { id: 'a', text: 'Very far (100+ meters)', scores: { CC_DS: 3, BAT: 2, LAT: 1 } },
      { id: 'b', text: 'Medium distance (20-50 meters)', scores: { BAT: 3, LAT: 2, CC_DS: 1 } },
      { id: 'c', text: 'Close range (under 10 meters)', scores: { LAT: 3, BAT: 2, CC_DS: 1 } },
      { id: 'd', text: 'It varies a lot', scores: { CC_DS: 2, BAT: 2, LAT: 2 } },
    ],
  },
  {
    id: 'q3',
    text: 'How does your dog respond to food/treats around triggers?',
    options: [
      { id: 'a', text: 'Takes treats but very roughly/snaps', scores: { BAT: 3, CC_DS: 2, LAT: 1 } },
      { id: 'b', text: 'Won\'t take treats at all when triggered', scores: { LAT: 3, BAT: 2, CC_DS: 1 } },
      { id: 'c', text: 'Takes treats normally, stays engaged', scores: { CC_DS: 3, BAT: 2, LAT: 2 } },
      { id: 'd', text: 'Only takes high-value treats (chicken, cheese)', scores: { BAT: 3, CC_DS: 2, LAT: 2 } },
    ],
  },
  {
    id: 'q4',
    text: 'What\'s your main training goal?',
    options: [
      { id: 'a', text: 'Teach my dog to look at me instead of triggers', scores: { LAT: 3, BAT: 1, CC_DS: 1 } },
      { id: 'b', text: 'Help my dog feel calmer around triggers', scores: { CC_DS: 3, BAT: 2, LAT: 1 } },
      { id: 'c', text: 'Learn to move away safely when needed', scores: { BAT: 3, CC_DS: 1, LAT: 1 } },
      { id: 'd', text: 'All of the above', scores: { BAT: 2, CC_DS: 2, LAT: 2 } },
    ],
  },
];

export default function AssessmentScreen() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [scores, setScores] = useState<AssessmentScores>(DEFAULT_SCORES);
  const [loadingState, setLoadingState] = useState(true);
  const [savingAnswer, setSavingAnswer] = useState(false);

  const calculateScores = (nextAnswers: Record<string, string>): AssessmentScores => {
    const nextScores: AssessmentScores = { ...DEFAULT_SCORES };

    for (const question of QUESTIONS) {
      const selectedOptionId = nextAnswers[question.id];
      if (!selectedOptionId) {
        continue;
      }

      const option = question.options.find((candidate) => candidate.id === selectedOptionId);
      if (!option) {
        continue;
      }

      nextScores.BAT += option.scores.BAT;
      nextScores.CC_DS += option.scores.CC_DS;
      nextScores.LAT += option.scores.LAT;
    }

    return nextScores;
  };

  const getBestTechnique = (nextScores: AssessmentScores): TechniqueKey => {
    return TECHNIQUE_PRIORITY.reduce((best, candidate) => {
      return nextScores[candidate] > nextScores[best] ? candidate : best;
    }, TECHNIQUE_PRIORITY[0]);
  };

  const persistState = async (
    nextQuestion: number,
    nextAnswers: Record<string, string>,
    nextScores: AssessmentScores
  ) => {
    await setOnboardingAssessmentState({
      currentQuestion: Math.max(0, Math.min(nextQuestion, QUESTIONS.length - 1)),
      answers: nextAnswers,
      scores: nextScores,
    });
  };

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        await setOnboardingComplete(false);
        await setOnboardingStep('assessment');

        const savedState = await getOnboardingAssessmentState();
        if (!savedState || !mounted) {
          return;
        }

        setAnswers(savedState.answers);
        setScores(savedState.scores);
        setCurrentQuestion(Math.max(0, Math.min(savedState.currentQuestion, QUESTIONS.length - 1)));
      } catch (error) {
        console.error('Failed to load assessment state:', error);
      } finally {
        if (mounted) {
          setLoadingState(false);
        }
      }
    };

    bootstrap().catch((error) => {
      console.error('Failed to bootstrap assessment:', error);
      if (mounted) {
        setLoadingState(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleAnswer = async (optionId: string) => {
    if (savingAnswer) {
      return;
    }

    setSavingAnswer(true);

    const question = QUESTIONS[currentQuestion];
    const nextAnswers = { ...answers, [question.id]: optionId };
    const nextScores = calculateScores(nextAnswers);

    setAnswers(nextAnswers);
    setScores(nextScores);

    try {
      if (currentQuestion < QUESTIONS.length - 1) {
        const nextQuestion = currentQuestion + 1;
        setCurrentQuestion(nextQuestion);
        await persistState(nextQuestion, nextAnswers, nextScores);
      } else {
        const bestTechnique = getBestTechnique(nextScores);
        await setOnboardingRecommendedTechnique(bestTechnique);
        await setOnboardingStep('technique');
        await setOnboardingAssessmentState(null);

        router.push({
          pathname: '/onboarding/technique',
          params: { technique: bestTechnique },
        });
      }
    } catch (error) {
      console.error('Failed to save assessment step:', error);
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleBack = async () => {
    if (currentQuestion === 0) {
      router.replace('/onboarding/dog-profile');
      return;
    }

    const nextQuestion = currentQuestion - 1;
    setCurrentQuestion(nextQuestion);
    try {
      await persistState(nextQuestion, answers, scores);
    } catch (error) {
      console.error('Failed to persist assessment back action:', error);
    }
  };

  const question = QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;

  if (loadingState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1D4ED8" />
          <Text style={styles.loadingText}>Loading your assessment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.stepLabel}>Step 3 of 4</Text>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>{currentQuestion === 0 ? 'Back' : 'Previous'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        
        <Text style={styles.progressText}>
          Question {currentQuestion + 1} of {QUESTIONS.length}
        </Text>

        <Text style={styles.question}>{question.text}</Text>

        <View style={styles.options}>
          {question.options.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={[
                styles.option,
                answers[question.id] === option.id && styles.optionSelected,
                savingAnswer && styles.optionDisabled,
              ]}
              onPress={() => {
                handleAnswer(option.id).catch((error) => {
                  console.error('Failed to process answer:', error);
                });
              }}
              disabled={savingAnswer}
            >
              <Text
                style={[
                  styles.optionText,
                  answers[question.id] === option.id && styles.optionTextSelected,
                ]}
              >
                {option.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FAFF',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: '#475569',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  stepLabel: {
    backgroundColor: '#E0F2FE',
    color: '#1D4ED8',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  backButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#EAF2FF',
  },
  backButtonText: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '700',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#DCE7F7',
    borderRadius: 2,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1D4ED8',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 24,
  },
  question: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 32,
    lineHeight: 32,
  },
  options: {
    gap: 12,
  },
  option: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D5E3F4',
  },
  optionSelected: {
    backgroundColor: '#DBEAFE',
    borderColor: '#1D4ED8',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionText: {
    fontSize: 16,
    color: '#334155',
    lineHeight: 24,
  },
  optionTextSelected: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
});
