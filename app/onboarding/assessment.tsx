import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Question {
  id: string;
  text: string;
  options: {
    id: string;
    text: string;
    scores: Record<string, number>;
  }[];
}

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
  const [scores, setScores] = useState({ BAT: 0, CC_DS: 0, LAT: 0 });

  const handleAnswer = (optionId: string, optionScores: Record<string, number>) => {
    const newAnswers = { ...answers, [QUESTIONS[currentQuestion].id]: optionId };
    setAnswers(newAnswers);
    
    const newScores = { ...scores };
    Object.entries(optionScores).forEach(([method, score]) => {
      newScores[method as keyof typeof scores] += score;
    });
    setScores(newScores);

    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      // Determine best technique based on scores
      const bestTechnique = Object.entries(newScores).reduce((a, b) => 
        newScores[a[0] as keyof typeof scores] > newScores[b[0] as keyof typeof scores] ? a : b
      )[0];
      
      router.push({
        pathname: '/onboarding/technique',
        params: { technique: bestTechnique },
      });
    }
  };

  const question = QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / QUESTIONS.length) * 100;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
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
              ]}
              onPress={() => handleAnswer(option.id, option.scores)}
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
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 32,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    marginBottom: 16,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 24,
  },
  question: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 32,
    lineHeight: 32,
  },
  options: {
    gap: 12,
  },
  option: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  optionSelected: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  optionText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  optionTextSelected: {
    color: '#7C3AED',
    fontWeight: '600',
  },
});
