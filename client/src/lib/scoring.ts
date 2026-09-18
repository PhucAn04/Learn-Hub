/**
 * Shared scoring & star rating utilities
 *
 * Logic quy đổi dựa trên Tỷ Lệ Ảnh Đúng (Accuracy Rate):
 * - >= 90%: 5 sao ⭐⭐⭐⭐⭐ (Xuất sắc)
 * - 75% - 89%: 4 sao ⭐⭐⭐⭐ (Khá tốt)
 * - 60% - 74%: 3 sao ⭐⭐⭐ (Đạt yêu cầu)
 * - 40% - 59%: 2 sao ⭐⭐ (Cần cố gắng)
 * - < 40%: 1 sao ⭐ (Cần dạy lại)
 */

export interface StarRatingInfo {
  stars: number;
  emoji: string;
  badgeEmoji: string;
  feedbackMessage: string;
  summaryTitle: string;
}

/**
 * Tính số sao từ tỷ lệ điểm chính xác (0 - 100)
 */
export function calculateStars(score: number): number {
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

/**
 * Lấy thông tin chi tiết về số sao, emoji và lời nhận xét
 */
export function getStarRatingInfo(score: number, misclassifiedCount = 0): StarRatingInfo {
  const stars = calculateStars(score);

  if (stars === 5) {
    return {
      stars: 5,
      emoji: '🦁',
      badgeEmoji: '🦁🌟',
      summaryTitle: 'Xuất sắc!',
      feedbackMessage: 'Xuất sắc! AI đoán gần như đúng hết!',
    };
  }

  if (stars === 4) {
    return {
      stars: 4,
      emoji: '🐨',
      badgeEmoji: '🐨⭐',
      summaryTitle: 'Khá tốt!',
      feedbackMessage: misclassifiedCount > 0
        ? `Khá tốt! AI chỉ nhầm ${misclassifiedCount} ảnh thôi.`
        : 'Khá tốt! AI chỉ nhầm vài câu thôi.',
    };
  }

  if (stars === 3) {
    return {
      stars: 3,
      emoji: '🐨',
      badgeEmoji: '🐨👍',
      summaryTitle: 'Đạt yêu cầu!',
      feedbackMessage: misclassifiedCount > 0
        ? `Đạt yêu cầu! AI đoán đúng phần lớn câu hỏi (nhầm ${misclassifiedCount} ảnh).`
        : 'Đạt yêu cầu! AI đoán đúng phần lớn câu hỏi.',
    };
  }

  if (stars === 2) {
    return {
      stars: 2,
      emoji: '🐣',
      badgeEmoji: '🐣💪',
      summaryTitle: 'Cần cố gắng!',
      feedbackMessage: misclassifiedCount > 0
        ? `Bạn AI còn nhầm ${misclassifiedCount} ảnh — bé xem lại mấy ảnh bị nhầm ở dưới nhé!`
        : 'AI đoán đúng khoảng một nửa số câu — cố lên nhé!',
    };
  }

  return {
    stars: 1,
    emoji: '🐣',
    badgeEmoji: '🐣💪',
    summaryTitle: 'Cần dạy lại!',
    feedbackMessage: 'AI còn nhầm nhiều lắm — cần dạy lại nhé!',
  };
}
