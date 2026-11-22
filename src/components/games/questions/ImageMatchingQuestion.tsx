import { useEffect, useMemo, useState } from 'react';
import GameFeedback from '@/components/games/GameFeedback';
import WordImage from '@/components/WordImage';
import { useSpeaker } from '@/hooks/useSpeaker';
import { useRevealShortcut, type QuestionProps } from '@/components/games/questions/questionShared';
import { shuffle } from '@/lib/random';
import { toWordResult, type WordResult } from '@/lib/games/types';
import type { Word } from '@/lib/vocabulary';

interface ImageMatchingQuestionProps extends QuestionProps {
  words: Word[];
}

const WRONG_FLASH_MS = 700;

export default function ImageMatchingQuestion({ words, onDone, isSaving }: ImageMatchingQuestionProps) {
  const speak = useSpeaker();
  const imageOrder = useMemo(() => shuffle(words), [words]);
  const wordOrder = useMemo(() => shuffle(words), [words]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<{ imageId: string; wordId: string } | null>(null);
  const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());

  const alignedWords = useMemo(() => {
    const matchedBySlot = new Map(imageOrder.map((word, index) => [index, matchedIds.has(word.id) ? word : null]));
    const remaining = wordOrder.filter((word) => !matchedIds.has(word.id));
    let remainingIndex = 0;
    return imageOrder.map((_word, index) => {
      const matched = matchedBySlot.get(index);
      if (matched) return matched;
      const next = remaining[remainingIndex];
      remainingIndex += 1;
      return next;
    });
  }, [imageOrder, wordOrder, matchedIds]);

  useEffect(() => {
    if (!wrongPair) return;
    const timer = window.setTimeout(() => {
      setSelectedImageId(null);
      setSelectedWordId(null);
      setWrongPair(null);
    }, WRONG_FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [wrongPair]);

  const match = (word: Word) => {
    setMatchedIds((previous) => new Set(previous).add(word.id));
    setSelectedImageId(null);
    setSelectedWordId(null);
    void speak(word.finnish, 'fi');
  };

  const revealNext = () => {
    const next = imageOrder.find((word) => !matchedIds.has(word.id));
    if (next) match(next);
  };
  useRevealShortcut(revealNext);

  const evaluate = (imageId: string, wordId: string) => {
    if (imageId === wordId) {
      const word = words.find((item) => item.id === imageId);
      if (word) match(word);
      return;
    }
    setWrongIds((previous) => new Set(previous).add(imageId));
    setWrongPair({ imageId, wordId });
  };

  const pickImage = (id: string) => {
    if (matchedIds.has(id) || wrongPair) return;
    setSelectedImageId(id);
    if (selectedWordId) evaluate(id, selectedWordId);
  };

  const pickWord = (id: string) => {
    if (matchedIds.has(id) || wrongPair) return;
    setSelectedWordId(id);
    if (selectedImageId) evaluate(selectedImageId, id);
  };

  const isDone = matchedIds.size === words.length;
  const results: WordResult[] = words.map((word) => toWordResult(word, !wrongIds.has(word.id)));
  const allCorrect = wrongIds.size === 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        <div className="flex min-w-0 flex-col items-center gap-3 sm:gap-4">
          {imageOrder.map((word) => (
            <button
              key={`img-${word.id}`}
              type="button"
              onClick={() => pickImage(word.id)}
              disabled={matchedIds.has(word.id)}
              className={`flex aspect-square w-full max-w-[min(100%,15vh)] items-center justify-center overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                wrongPair?.imageId === word.id
                  ? 'border-rose-500 animate-pulse'
                  : matchedIds.has(word.id)
                    ? 'border-emerald-400'
                    : selectedImageId === word.id
                      ? 'border-blue-600 ring-2 ring-blue-100'
                      : 'border-slate-200 hover:border-blue-400 hover:shadow-sm'
              }`}
            >
              <WordImage
                src={word.image_url}
                alt={word.finnish}
                fit="contain"
                className="h-full w-full bg-slate-50"
              />
            </button>
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
          {alignedWords.map((word, index) => (
            <button
              key={`word-${word.id}-${index}`}
              type="button"
              onClick={() => pickWord(word.id)}
              disabled={matchedIds.has(word.id)}
              className={`flex min-h-[clamp(96px,15vh,170px)] w-full min-w-0 items-center justify-center rounded-lg border-2 px-2 py-2 text-center text-xs font-semibold leading-5 transition-all duration-300 sm:text-sm ${
                wrongPair?.wordId === word.id
                  ? 'border-rose-500 bg-rose-50 text-rose-800 animate-pulse'
                  : matchedIds.has(word.id)
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : selectedWordId === word.id
                      ? 'border-blue-600 bg-blue-100/80 text-blue-900 ring-2 ring-blue-100'
                      : 'border-slate-200 bg-blue-50/70 text-slate-900 hover:border-blue-400 hover:bg-blue-100/70 hover:shadow-sm'
              }`}
            >
              <span className="break-words">{word.finnish}</span>
            </button>
          ))}
        </div>
      </div>

      {isDone && (
        <GameFeedback
          correct={allCorrect}
          title={allCorrect ? 'Tüm eşleşmeler doğru!' : 'Tüm eşleşmeler tamamlandı'}
          detail={allCorrect ? undefined : `${results.filter((result) => result.correct).length} / ${words.length} kelimeyi ilk denemede eşleştirdiniz.`}
          isSaving={isSaving}
          onContinue={() => onDone(results)}
        />
      )}
    </section>
  );
}
