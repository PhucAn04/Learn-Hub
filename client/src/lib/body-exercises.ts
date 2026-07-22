/**
 * Body Exercise Definitions — 5 bài tập thể dục cho trẻ
 *
 * Mỗi bài tập có nhiều tư thế (pose) mà bé cần dạy AI nhận biết.
 * Dùng chung với useMl5BodyPose + body-pose-classifier.
 */

export interface ExercisePose {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

export interface BodyExercise {
  id: string;
  name: string;
  emoji: string;
  description: string;
  poses: ExercisePose[];
}

export const BODY_EXERCISES: BodyExercise[] = [
  // ── 1. Vươn Thở ──────────────────────────────────────
  {
    id: 'vuon-tho',
    name: 'Động Tác Vươn Thở',
    emoji: '🧘',
    description:
      'Dang 2 chân, vươn thẳng 2 tay hình chữ V, sau đó hạ thấp 2 tay chéo xuống.',
    poses: [
      {
        id: 'vuon-tho-1',
        label: 'Vươn Tay Chữ V',
        emoji: '🙌',
        description:
          'Dang 2 chân rộng bằng vai, 2 tay vươn thẳng lên cao tạo hình chữ V.',
      },
      {
        id: 'vuon-tho-2',
        label: 'Hạ Tay Chéo Xuống',
        emoji: '✖️',
        description:
          'Hạ 2 tay xuống thấp bắt chéo trước người.',
      },
    ],
  },

  // ── 2. Tay ────────────────────────────────────────────
  {
    id: 'tay',
    name: 'Động Tác Tay',
    emoji: '💪',
    description:
      'Dang 2 chân, 2 tay ngang vai, gập 2 tay thẳng đứng lên cao, trả về ngang vai.',
    poses: [
      {
        id: 'tay-1',
        label: 'Tay Ngang Vai',
        emoji: '➡️',
        description:
          'Dang 2 chân rộng bằng vai, 2 tay dang ngang bằng vai.',
      },
      {
        id: 'tay-2',
        label: 'Tay Gập Lên Cao',
        emoji: '🙆',
        description:
          'Gập 2 cẳng tay thẳng đứng lên cao (khuỷu tay vẫn ngang vai).',
      },
    ],
  },

  // ── 3. Lườn ───────────────────────────────────────────
  {
    id: 'luon',
    name: 'Động Tác Lườn',
    emoji: '🤸',
    description:
      'Nghiêng người sang trái rồi sang phải.',
    poses: [
      {
        id: 'luon-1',
        label: 'Tay Ngang Vai',
        emoji: '➡️',
        description:
          'Đứng thẳng, 2 tay dang ngang vai.',
      },
      {
        id: 'luon-2',
        label: 'Nghiêng Trái',
        emoji: '↙️',
        description:
          'Tay trái chống ngang hông, tay phải duỗi thẳng nghiêng sang trái.',
      },
      {
        id: 'luon-3',
        label: 'Nghiêng Phải',
        emoji: '↘️',
        description:
          'Tay phải chống ngang hông, tay trái duỗi thẳng nghiêng sang phải.',
      },
    ],
  },

  // ── 4. Bụng ───────────────────────────────────────────
  {
    id: 'bung',
    name: 'Động Tác Bụng',
    emoji: '🏋️',
    description:
      'Vươn tay chữ V, cúi người chạm chân, rồi đứng thẳng lại.',
    poses: [
      {
        id: 'bung-1',
        label: 'Vươn Tay Chữ V',
        emoji: '🙌',
        description:
          'Dang 2 chân, 2 tay vươn thẳng lên cao tạo hình chữ V.',
      },
      {
        id: 'bung-2',
        label: 'Cúi Chạm Chân',
        emoji: '🦵',
        description:
          'Cúi người thấp xuống, mũi ngón tay chạm chân, lòng bàn tay hướng vào trong.',
      },
      {
        id: 'bung-3',
        label: 'Đứng Thẳng',
        emoji: '🧍',
        description:
          'Đứng thẳng người bình thường, 2 tay buông xuôi.',
      },
    ],
  },

  // ── 5. Chân ───────────────────────────────────────────
  {
    id: 'chan',
    name: 'Động Tác Chân',
    emoji: '🦿',
    description:
      'Dang chân rộng hơn vai, khụy chân trái rồi chân phải, 2 tay chập trước ngực.',
    poses: [
      {
        id: 'chan-1',
        label: 'Dang Chân Tay Ngang',
        emoji: '➡️',
        description:
          'Dang 2 chân rộng hơn vai, 2 tay dang ngang vai.',
      },
      {
        id: 'chan-2',
        label: 'Khụy Chân Trái',
        emoji: '⬅️',
        description:
          'Khụy chân trái thấp xuống, 2 bàn tay chập thẳng trước ngực.',
      },
      {
        id: 'chan-3',
        label: 'Đứng Thẳng',
        emoji: '🧍',
        description:
          'Đứng thẳng người bình thường.',
      },
      {
        id: 'chan-4',
        label: 'Khụy Chân Phải',
        emoji: '➡️',
        description:
          'Khụy chân phải thấp xuống, 2 bàn tay chập thẳng trước ngực.',
      },
    ],
  },
];

/**
 * Get exercise by ID
 */
export function getExerciseById(id: string): BodyExercise | undefined {
  return BODY_EXERCISES.find((ex) => ex.id === id);
}

/**
 * Convert exercise poses to the class format used by TeachPanel / DataCollector
 */
export function exercisePosesToClasses(
  exercise: BodyExercise,
): { id: string; label: string; emoji: string }[] {
  return exercise.poses.map((pose) => ({
    id: pose.id,
    label: `${pose.label} ${pose.emoji}`,
    emoji: pose.emoji,
  }));
}
