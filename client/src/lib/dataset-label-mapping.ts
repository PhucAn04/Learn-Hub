/**
 * Dataset Label Mapping & Validation Catalog
 * Ánh xạ nhãn tiếng Việt ⟷ tiếng Anh cho 5 bộ dataset kiểm thử AI:
 * 1. Cats_And_Dogs_Mini_Dataset (Chó & Mèo)
 * 2. Fruit_Classification_10_Class (10 Loại Trái Cây)
 * 3. Pest_Dataset (9 Loại Côn Trùng & Sâu Bệnh)
 * 4. Plant_Village (Lá Khỏe Mạnh vs Lá Có Đốm / Bị Bệnh)
 * 5. Rock_Paper_Scissors_Images (Kéo - Búa - Bao)
 *
 * Đóng vai trò làm từ điển chuẩn hóa và đối soát ảnh đúng/sai (Validation/Test)
 * cho giao diện huấn luyện AI của Giáo viên (Teach Free / Teach Action).
 */

export type DatasetId =
  | 'cats-and-dogs'
  | 'fruit-10'
  | 'pest'
  | 'plant-village'
  | 'rock-paper-scissors';

export interface ClassLabelMapping {
  /** Mã định danh lớp */
  key: string;
  /** Tên hiển thị chuẩn tiếng Việt */
  labelVi: string;
  /** Tên hiển thị chuẩn tiếng Anh */
  labelEn: string;
  /** Emoji biểu trưng */
  emoji: string;
  /** Danh sách tên tiếng Anh (chữ hoa, chữ thường, số nhiều, biến thể) */
  englishNames: string[];
  /** Danh sách tên tiếng Việt (có dấu, không dấu, chữ hoa, chữ thường, từ đồng nghĩa) */
  vietnameseNames: string[];
  /** Đường dẫn thư mục chứa ảnh chính */
  folderPath: string;
  /** Đường dẫn thư mục ảnh kiểm thử (test/val nếu có) */
  testFolderPath?: string;
  /** Các lỗi chính tả thường gặp trong dataset gốc (nếu có) */
  knownFolderTypos?: string[];
  /** Định dạng file ảnh trong thư mục */
  imageExtensions: string[];
  /** Ghi chú sư phạm hoặc lưu ý nhận diện */
  notes?: string;
}

export interface DatasetInfo {
  id: DatasetId;
  nameVi: string;
  nameEn: string;
  folderName: string;
  basePath: string;
  description: string;
  totalImages: number;
  classCount: number;
  classes: ClassLabelMapping[];
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. DATASET 1: CATS AND DOGS MINI DATASET
// ─────────────────────────────────────────────────────────────────────────────
export const CATS_AND_DOGS_DATASET: DatasetInfo = {
  id: 'cats-and-dogs',
  nameVi: 'Chó và Mèo (Mini Dataset)',
  nameEn: 'Cats and Dogs Mini Dataset',
  folderName: 'Cats_And_Dogs_Mini_Dataset',
  basePath: 'dataset/Cats_And_Dogs_Mini_Dataset',
  description: 'Bộ ảnh nhị phân phân biệt chó và mèo gồm 1.000 ảnh chuẩn màu RGB (500 ảnh/lớp).',
  totalImages: 1000,
  classCount: 2,
  classes: [
    {
      key: 'dog',
      labelVi: 'Chó',
      labelEn: 'Dog',
      emoji: '🐶',
      englishNames: [
        'Dog',
        'dog',
        'Dogs',
        'dogs',
        'Puppy',
        'puppy',
        'Puppies',
        'puppies',
        'Canine',
        'canine',
        'Hound',
        'hound',
      ],
      vietnameseNames: [
        'Chó',
        'chó',
        'Cho',
        'cho',
        'Cún',
        'cún',
        'Cun',
        'cun',
        'Chó con',
        'chó con',
        'Cún con',
        'cún con',
        'Cún cưng',
        'cún cưng',
        'Con chó',
        'con chó',
        'Gâu gâu',
        'gâu gâu',
      ],
      folderPath: 'dataset/Cats_And_Dogs_Mini_Dataset/dogs_set',
      imageExtensions: ['.jpg'],
      notes: 'Ảnh gồm nhiều giống chó khác nhau ở cự ly gần và xa.',
    },
    {
      key: 'cat',
      labelVi: 'Mèo',
      labelEn: 'Cat',
      emoji: '🐱',
      englishNames: [
        'Cat',
        'cat',
        'Cats',
        'cats',
        'Kitten',
        'kitten',
        'Kittens',
        'kittens',
        'Feline',
        'feline',
        'Kitty',
        'kitty',
      ],
      vietnameseNames: [
        'Mèo',
        'mèo',
        'Meo',
        'meo',
        'Mèo con',
        'mèo con',
        'Miu',
        'miu',
        'Miu miu',
        'miu miu',
        'Con mèo',
        'con mèo',
        'Mèo cưng',
        'mèo cưng',
        'Meo meo',
        'meo meo',
      ],
      folderPath: 'dataset/Cats_And_Dogs_Mini_Dataset/cats_set',
      imageExtensions: ['.jpg'],
      notes: 'Gồm các chú mèo lông ngắn, lông dài ở tư thế nằm hoặc đứng.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DATASET 2: FRUIT CLASSIFICATION 10 CLASS
// ─────────────────────────────────────────────────────────────────────────────
export const FRUIT_CLASSIFICATION_DATASET: DatasetInfo = {
  id: 'fruit-10',
  nameVi: '10 Loại Trái Cây',
  nameEn: 'Fruit Classification 10 Class',
  folderName: 'Fruit_Classification_10_Class',
  basePath: 'dataset/Fruit_Classification_10_Class',
  description: 'Bộ ảnh 10 loại quả phổ biến với 3.374 ảnh (chia train 2.306 ảnh, test 1.020 ảnh, predict 48 ảnh).',
  totalImages: 3374,
  classCount: 10,
  classes: [
    {
      key: 'apple',
      labelVi: 'Táo',
      labelEn: 'Apple',
      emoji: '🍎',
      englishNames: ['Apple', 'apple', 'Apples', 'apples', 'Red apple', 'Green apple'],
      vietnameseNames: [
        'Táo',
        'táo',
        'Tao',
        'tao',
        'Quả táo',
        'quả táo',
        'Trái táo',
        'trái táo',
        'Táo đỏ',
        'táo đỏ',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/Apple',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/apple',
      imageExtensions: ['.jpeg'],
    },
    {
      key: 'avocado',
      labelVi: 'Bơ',
      labelEn: 'Avocado',
      emoji: '🥑',
      englishNames: ['Avocado', 'avocado', 'Avocados', 'avocados'],
      vietnameseNames: [
        'Bơ',
        'bơ',
        'Bo',
        'bo',
        'Quả bơ',
        'quả bơ',
        'Trái bơ',
        'trái bơ',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/avocado',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/avocado',
      imageExtensions: ['.jpeg'],
    },
    {
      key: 'banana',
      labelVi: 'Chuối',
      labelEn: 'Banana',
      emoji: '🍌',
      englishNames: ['Banana', 'banana', 'Bananas', 'bananas'],
      vietnameseNames: [
        'Chuối',
        'chuối',
        'Chuoi',
        'chuoi',
        'Quả chuối',
        'quả chuối',
        'Trái chuối',
        'trái chuối',
        'Nải chuối',
        'nải chuối',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/Banana',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/banana',
      imageExtensions: ['.jpeg'],
    },
    {
      key: 'cherry',
      labelVi: 'Anh Đào (Cherry)',
      labelEn: 'Cherry',
      emoji: '🍒',
      englishNames: ['Cherry', 'cherry', 'Cherries', 'cherries'],
      vietnameseNames: [
        'Cherry',
        'cherry',
        'Anh đào',
        'anh đào',
        'Anh dao',
        'anh dao',
        'Quả cherry',
        'quả cherry',
        'Trái anh đào',
        'trái anh đào',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/cherry',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/cherry',
      imageExtensions: ['.jpeg'],
    },
    {
      key: 'kiwi',
      labelVi: 'Kiwi',
      labelEn: 'Kiwi',
      emoji: '🥝',
      englishNames: ['Kiwi', 'kiwi', 'Kiwis', 'kiwis', 'Kiwifruit', 'kiwifruit'],
      vietnameseNames: [
        'Kiwi',
        'kiwi',
        'Quả kiwi',
        'quả kiwi',
        'Trái kiwi',
        'trái kiwi',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/kiwi',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/kiwi',
      imageExtensions: ['.jpeg'],
    },
    {
      key: 'mango',
      labelVi: 'Xoài',
      labelEn: 'Mango',
      emoji: '🥭',
      englishNames: ['Mango', 'mango', 'Mangoes', 'mangoes', 'Mangos', 'mangos'],
      vietnameseNames: [
        'Xoài',
        'xoài',
        'Xoai',
        'xoai',
        'Quả xoài',
        'quả xoài',
        'Trái xoài',
        'trái xoài',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/mango',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/mango',
      imageExtensions: ['.jpeg'],
    },
    {
      key: 'orange',
      labelVi: 'Cam',
      labelEn: 'Orange',
      emoji: '🍊',
      englishNames: ['Orange', 'orange', 'Oranges', 'oranges'],
      vietnameseNames: [
        'Cam',
        'cam',
        'Quả cam',
        'quả cam',
        'Trái cam',
        'trái cam',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/orange',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/orange',
      imageExtensions: ['.jpeg'],
    },
    {
      key: 'pineapple',
      labelVi: 'Dứa (Thơm / Khóm)',
      labelEn: 'Pineapple',
      emoji: '🍍',
      englishNames: [
        'Pineapple',
        'pineapple',
        'Pineapples',
        'pineapples',
        'Pinenapple',
        'pinenapple',
      ],
      vietnameseNames: [
        'Dứa',
        'dứa',
        'Dua',
        'dua',
        'Thơm',
        'thơm',
        'Thom',
        'thom',
        'Khóm',
        'khóm',
        'Khom',
        'khom',
        'Quả dứa',
        'quả dứa',
        'Trái thơm',
        'trái thơm',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/pinenapple',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/pinenapple',
      knownFolderTypos: ['pinenapple'],
      imageExtensions: ['.jpeg'],
      notes: 'Thư mục dataset gốc có lỗi chính tả pinenapple (thêm chữ n).',
    },
    {
      key: 'strawberry',
      labelVi: 'Dâu Tây',
      labelEn: 'Strawberry',
      emoji: '🍓',
      englishNames: [
        'Strawberry',
        'strawberry',
        'Strawberries',
        'strawberries',
        'Stawberries',
        'stawberries',
      ],
      vietnameseNames: [
        'Dâu tây',
        'dâu tây',
        'Dau tay',
        'dau tay',
        'Dâu',
        'dâu',
        'Dau',
        'dau',
        'Quả dâu',
        'quả dâu',
        'Trái dâu tây',
        'trái dâu tây',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/strawberries',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/stawberries',
      knownFolderTypos: ['stawberries'],
      imageExtensions: ['.jpeg'],
      notes: 'Thư mục test có lỗi chính tả stawberries (thiếu chữ r).',
    },
    {
      key: 'watermelon',
      labelVi: 'Dưa Hấu',
      labelEn: 'Watermelon',
      emoji: '🍉',
      englishNames: ['Watermelon', 'watermelon', 'Watermelons', 'watermelons'],
      vietnameseNames: [
        'Dưa hấu',
        'dưa hấu',
        'Dua hau',
        'dua hau',
        'Quả dưa hấu',
        'quả dưa hấu',
        'Trái dưa hấu',
        'trái dưa hấu',
      ],
      folderPath: 'dataset/Fruit_Classification_10_Class/train/watermelon',
      testFolderPath: 'dataset/Fruit_Classification_10_Class/test/watermelon',
      imageExtensions: ['.jpeg'],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. DATASET 3: PEST DATASET (CÔN TRÙNG & SÂU BỆNH)
// ─────────────────────────────────────────────────────────────────────────────
export const PEST_DATASET: DatasetInfo = {
  id: 'pest',
  nameVi: 'Côn Trùng & Sâu Bệnh Nông Nghiệp',
  nameEn: 'Pest Dataset',
  folderName: 'Pest_Dataset',
  basePath: 'dataset/Pest_Dataset',
  description: 'Bộ ảnh 9 loài sâu bệnh gây hại nông nghiệp gồm 3.150 ảnh (train 2.700 ảnh, test 450 ảnh).',
  totalImages: 3150,
  classCount: 9,
  classes: [
    {
      key: 'aphids',
      labelVi: 'Rệp Muội (Rệp Cây)',
      labelEn: 'Aphids',
      emoji: '🪲',
      englishNames: ['Aphids', 'aphids', 'Aphid', 'aphid', 'Plant louse', 'Greenfly'],
      vietnameseNames: [
        'Rệp muội',
        'rệp muội',
        'Rep muoi',
        'rep muoi',
        'Rệp',
        'rệp',
        'Rep',
        'rep',
        'Rệp cây',
        'rệp cây',
        'Rầy mềm',
        'rầy mềm',
      ],
      folderPath: 'dataset/Pest_Dataset/train/aphids',
      testFolderPath: 'dataset/Pest_Dataset/test/aphids',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'armyworm',
      labelVi: 'Sâu Keo (Sâu Cắn Lá)',
      labelEn: 'Armyworm',
      emoji: '🐛',
      englishNames: ['Armyworm', 'armyworm', 'Armyworms', 'armyworms', 'Fall armyworm'],
      vietnameseNames: [
        'Sâu keo',
        'sâu keo',
        'Sau keo',
        'sau keo',
        'Sâu cắn lá',
        'sâu cắn lá',
        'Sau can la',
        'sau can la',
        'Sâu cắn gié',
        'sâu cắn gié',
      ],
      folderPath: 'dataset/Pest_Dataset/train/armyworm',
      testFolderPath: 'dataset/Pest_Dataset/test/armyworm',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'beetle',
      labelVi: 'Bọ Cánh Cứng',
      labelEn: 'Beetle',
      emoji: '🪲',
      englishNames: [
        'Beetle',
        'beetle',
        'Beetles',
        'beetles',
        'Pest',
        'pest',
        'Harmful insect',
        'harmful insect',
        'Bug',
        'bug',
      ],
      vietnameseNames: [
        'Bọ cánh cứng',
        'bọ cánh cứng',
        'Bo canh cung',
        'bo canh cung',
        'Bọ',
        'bọ',
        'Bo',
        'bo',
        'Con bọ',
        'con bọ',
        'Côn trùng gây hại',
        'côn trùng gây hại',
        'Con trung gay hai',
        'con trung gay hai',
        'Sâu bọ',
        'sâu bọ',
        'Sau bo',
        'sau bo',
        'Sâu hại',
        'sâu hại',
      ],
      folderPath: 'dataset/Pest_Dataset/train/beetle',
      testFolderPath: 'dataset/Pest_Dataset/test/beetle',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'bollworm',
      labelVi: 'Sâu Đục Quả (Sâu Xanh)',
      labelEn: 'Bollworm',
      emoji: '🐛',
      englishNames: ['Bollworm', 'bollworm', 'Bollworms', 'bollworms', 'Cotton bollworm'],
      vietnameseNames: [
        'Sâu đục quả',
        'sâu đục quả',
        'Sau duc qua',
        'sau duc qua',
        'Sâu xanh',
        'sâu xanh',
        'Sau xanh',
        'sau xanh',
        'Sâu đục nụ',
        'sâu đục nụ',
      ],
      folderPath: 'dataset/Pest_Dataset/train/bollworm',
      testFolderPath: 'dataset/Pest_Dataset/test/bollworm',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'grasshopper',
      labelVi: 'Châu Chấu (Cào Cào)',
      labelEn: 'Grasshopper',
      emoji: '🦗',
      englishNames: ['Grasshopper', 'grasshopper', 'Grasshoppers', 'grasshoppers', 'Locust', 'locust'],
      vietnameseNames: [
        'Châu chấu',
        'châu chấu',
        'Chau chau',
        'chau chau',
        'Cào cào',
        'cào cào',
        'Cao cao',
        'cao cao',
      ],
      folderPath: 'dataset/Pest_Dataset/train/grasshopper',
      testFolderPath: 'dataset/Pest_Dataset/test/grasshopper',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'mites',
      labelVi: 'Bọ Ve (Nhện Đỏ)',
      labelEn: 'Mites',
      emoji: '🕷️',
      englishNames: ['Mites', 'mites', 'Mite', 'mite', 'Spider mite', 'spider mites'],
      vietnameseNames: [
        'Bọ ve',
        'bọ ve',
        'Bo ve',
        'bo ve',
        'Nhện đỏ',
        'nhện đỏ',
        'Nhen do',
        'nhen do',
        'Mạt',
        'mạt',
        'Mat',
        'mat',
      ],
      folderPath: 'dataset/Pest_Dataset/train/mites',
      testFolderPath: 'dataset/Pest_Dataset/test/mites',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'mosquito',
      labelVi: 'Muỗi',
      labelEn: 'Mosquito',
      emoji: '🦟',
      englishNames: ['Mosquito', 'mosquito', 'Mosquitoes', 'mosquitoes', 'Mosquitos', 'mosquitos'],
      vietnameseNames: [
        'Muỗi',
        'muỗi',
        'Muoi',
        'muoi',
        'Con muỗi',
        'con muỗi',
      ],
      folderPath: 'dataset/Pest_Dataset/train/mosquito',
      testFolderPath: 'dataset/Pest_Dataset/test/mosquito',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'sawfly',
      labelVi: 'Ong Cắn Lá (Ruồi Cưa)',
      labelEn: 'Sawfly',
      emoji: '🐝',
      englishNames: ['Sawfly', 'sawfly', 'Sawflies', 'sawflies'],
      vietnameseNames: [
        'Ong cắn lá',
        'ong cắn lá',
        'Ong can la',
        'ong can la',
        'Ruồi cưa',
        'ruồi cưa',
        'Ruoi cua',
        'ruoi cua',
      ],
      folderPath: 'dataset/Pest_Dataset/train/sawfly',
      testFolderPath: 'dataset/Pest_Dataset/test/sawfly',
      imageExtensions: ['.jpg'],
    },
    {
      key: 'stem_borer',
      labelVi: 'Sâu Đục Thân',
      labelEn: 'Stem Borer',
      emoji: '🐛',
      englishNames: [
        'Stem borer',
        'stem borer',
        'Stem_borer',
        'stem_borer',
        'Stem borers',
        'stem borers',
        'Stalk borer',
      ],
      vietnameseNames: [
        'Sâu đục thân',
        'sâu đục thân',
        'Sau duc than',
        'sau duc than',
        'Sâu đục thân lúa',
        'sâu đục thân lúa',
      ],
      folderPath: 'dataset/Pest_Dataset/train/stem_borer',
      testFolderPath: 'dataset/Pest_Dataset/test/stem_borer',
      imageExtensions: ['.jpg'],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. DATASET 4: PLANT VILLAGE (LÁ KHỎE MẠNH VS LÁ CÓ ĐỐM / BỆNH)
// ─────────────────────────────────────────────────────────────────────────────
export const PLANT_VILLAGE_DATASET: DatasetInfo = {
  id: 'plant-village',
  nameVi: 'Bệnh Lá Cây Trồng (PlantVillage)',
  nameEn: 'PlantVillage Leaf Disease Dataset',
  folderName: 'Plant_Village',
  basePath: 'dataset/Plant_Village',
  description:
    'Bộ ảnh 54.305 ảnh lá cây gồm 38 lớp bệnh và khỏe mạnh trên 14 loài thực vật. Hỗ trợ cả nhận diện theo loài cây hoặc bài toán nhị phân "Lá Khỏe Mạnh vs Lá Có Đốm".',
  totalImages: 54305,
  classCount: 38,
  classes: [
    // ── Nhóm nhị phân thông dụng trong giảng dạy thiếu nhi ──
    {
      key: 'healthy_leaf',
      labelVi: 'Lá Khỏe Mạnh (Lá Không Đốm)',
      labelEn: 'Healthy Leaf',
      emoji: '🌿',
      englishNames: [
        'Healthy',
        'healthy',
        'Healthy leaf',
        'healthy leaf',
        'Healthy leaves',
        'healthy leaves',
        'Clean leaf',
        'clean leaf',
        'Normal leaf',
      ],
      vietnameseNames: [
        'Lá khỏe',
        'lá khỏe',
        'La khoe',
        'la khoe',
        'Lá khỏe mạnh',
        'lá khỏe mạnh',
        'Khỏe mạnh',
        'khỏe mạnh',
        'Khoe manh',
        'khoe manh',
        'Lá không đốm',
        'lá không đốm',
        'Không đốm',
        'không đốm',
        'La khong dom',
        'la khong dom',
        'Lá sạch',
        'lá sạch',
        'Không bệnh',
        'không bệnh',
      ],
      folderPath: 'dataset/Plant_Village/train/Tomato___healthy',
      testFolderPath: 'dataset/Plant_Village/val/Tomato___healthy',
      imageExtensions: ['.JPG', '.jpg', '.png'],
      notes: 'Bao gồm 12 thư mục *___healthy (Apple, Corn, Grape, Peach, Tomato...)',
    },
    {
      key: 'diseased_leaf',
      labelVi: 'Lá Bị Bệnh (Lá Có Đốm)',
      labelEn: 'Diseased / Spotted Leaf',
      emoji: '🍂',
      englishNames: [
        'Diseased',
        'diseased',
        'Diseased leaf',
        'diseased leaf',
        'Sick leaf',
        'sick leaf',
        'Spotted leaf',
        'spotted leaf',
        'Leaf spot',
        'leaf spot',
        'Blight',
        'blight',
        'Rot',
        'rot',
        'Rust',
        'rust',
      ],
      vietnameseNames: [
        'Lá bệnh',
        'lá bệnh',
        'La benh',
        'la benh',
        'Lá bị bệnh',
        'lá bị bệnh',
        'Bị bệnh',
        'bị bệnh',
        'Lá có đốm',
        'lá có đốm',
        'Có đốm',
        'có đốm',
        'La co dom',
        'la co dom',
        'Đốm lá',
        'đốm lá',
        'Dom la',
        'dom la',
        'Lá đốm',
        'lá đốm',
        'Lá sâu bệnh',
        'lá sâu bệnh',
      ],
      folderPath: 'dataset/Plant_Village/train/Tomato___Target_Spot',
      testFolderPath: 'dataset/Plant_Village/val/Tomato___Target_Spot',
      imageExtensions: ['.JPG', '.jpg', '.png'],
      notes: 'Bao gồm 26 thư mục bệnh đốm lá, gỉ sắt, mốc sương, virus...',
    },
    // ── Một số lớp bệnh cụ thể phổ biến ──
    {
      key: 'apple_scab',
      labelVi: 'Lá Táo Bị Bệnh Vảy (Apple Scab)',
      labelEn: 'Apple Scab',
      emoji: '🍏',
      englishNames: ['Apple scab', 'apple scab', 'Apple___Apple_scab'],
      vietnameseNames: ['Bệnh vảy táo', 'bệnh vảy táo', 'Táo bị vảy', 'táo bị vảy', 'Đốm vảy táo'],
      folderPath: 'dataset/Plant_Village/train/Apple___Apple_scab',
      testFolderPath: 'dataset/Plant_Village/val/Apple___Apple_scab',
      imageExtensions: ['.JPG', '.jpg'],
    },
    {
      key: 'tomato_early_blight',
      labelVi: 'Lá Cà Chua Đốm Vòng (Early Blight)',
      labelEn: 'Tomato Early Blight',
      emoji: '🍅',
      englishNames: ['Tomato early blight', 'early blight', 'Tomato___Early_blight'],
      vietnameseNames: ['Đốm vòng cà chua', 'đốm vòng cà chua', 'Cà chua đốm vòng', 'Bệnh đốm vòng'],
      folderPath: 'dataset/Plant_Village/train/Tomato___Early_blight',
      testFolderPath: 'dataset/Plant_Village/val/Tomato___Early_blight',
      imageExtensions: ['.JPG', '.jpg'],
    },
    {
      key: 'corn_common_rust',
      labelVi: 'Lá Ngô Gỉ Sắt (Common Rust)',
      labelEn: 'Corn Common Rust',
      emoji: '🌽',
      englishNames: ['Corn common rust', 'common rust', 'Corn_(maize)___Common_rust_'],
      vietnameseNames: ['Gỉ sắt ngô', 'gỉ sắt ngô', 'Bắp bị gỉ sắt', 'Gỉ sắt bắp', 'Đốm gỉ sắt'],
      folderPath: 'dataset/Plant_Village/train/Corn_(maize)___Common_rust_',
      testFolderPath: 'dataset/Plant_Village/val/Corn_(maize)___Common_rust_',
      knownFolderTypos: ['Corn_(maize)___Common_rust_'],
      imageExtensions: ['.JPG', '.jpg'],
      notes: 'Folder dataset có dấu gạch dưới cuối tên.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. DATASET 5: ROCK PAPER SCISSORS IMAGES (KÉO - BÚA - BAO)
// ─────────────────────────────────────────────────────────────────────────────
export const ROCK_PAPER_SCISSORS_DATASET: DatasetInfo = {
  id: 'rock-paper-scissors',
  nameVi: 'Oẳn Tù Tì (Kéo - Búa - Bao)',
  nameEn: 'Rock Paper Scissors Images',
  folderName: 'Rock_Paper_Scissors_Images',
  basePath: 'dataset/Rock_Paper_Scissors_Images',
  description: 'Bộ ảnh 3 tư thế bàn tay trò chơi Oẳn Tù Tì gồm 2.188 ảnh gốc (Kéo 750, Búa 726, Bao 712) chụp trên phông xanh lá.',
  totalImages: 4378,
  classCount: 3,
  classes: [
    {
      key: 'rock',
      labelVi: 'Búa (Hòn Đá / Nắm Đấm)',
      labelEn: 'Rock',
      emoji: '✊',
      englishNames: ['Rock', 'rock', 'Rocks', 'rocks', 'Stone', 'stone', 'Fist', 'fist'],
      vietnameseNames: [
        'Búa',
        'búa',
        'Bua',
        'bua',
        'Đá',
        'đá',
        'Da',
        'da',
        'Hòn đá',
        'hòn đá',
        'Hon da',
        'hon da',
        'Nắm đấm',
        'nắm đấm',
        'Nam dam',
        'nam dam',
        'Nắm tay',
        'nắm tay',
      ],
      folderPath: 'dataset/Rock_Paper_Scissors_Images/rock',
      imageExtensions: ['.png'],
      notes: 'Bàn tay nắm chặt tạo hình quả đấm/búa.',
    },
    {
      key: 'paper',
      labelVi: 'Bao (Giấy / Lá / Xòe Tay)',
      labelEn: 'Paper',
      emoji: '✋',
      englishNames: ['Paper', 'paper', 'Papers', 'papers', 'Sheet', 'sheet', 'Open hand', 'open hand'],
      vietnameseNames: [
        'Bao',
        'bao',
        'Giấy',
        'giấy',
        'Giay',
        'giay',
        'Lá',
        'lá',
        'La',
        'la',
        'Xòe tay',
        'xòe tay',
        'Xoe tay',
        'xoe tay',
        'Bàn tay xòe',
        'bàn tay xòe',
      ],
      folderPath: 'dataset/Rock_Paper_Scissors_Images/paper',
      imageExtensions: ['.png'],
      notes: 'Bàn tay mở rộng đủ 5 ngón.',
    },
    {
      key: 'scissors',
      labelVi: 'Kéo (Ngón Tay Kéo)',
      labelEn: 'Scissors',
      emoji: '✌️',
      englishNames: ['Scissors', 'scissors', 'Scissor', 'scissor'],
      vietnameseNames: [
        'Kéo',
        'kéo',
        'Keo',
        'keo',
        'Cái kéo',
        'cái kéo',
        'Cai keo',
        'cai keo',
        'Hai ngón',
        'hai ngón',
        'Ngón kéo',
        'ngón kéo',
      ],
      folderPath: 'dataset/Rock_Paper_Scissors_Images/scissors',
      imageExtensions: ['.png'],
      notes: 'Hai ngón tay giơ chữ V tạo hình cái kéo.',
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// TOÀN BỘ DANH MỤC DATASET
// ─────────────────────────────────────────────────────────────────────────────
export const ALL_DATASETS: DatasetInfo[] = [
  CATS_AND_DOGS_DATASET,
  FRUIT_CLASSIFICATION_DATASET,
  PEST_DATASET,
  PLANT_VILLAGE_DATASET,
  ROCK_PAPER_SCISSORS_DATASET,
];

// ─────────────────────────────────────────────────────────────────────────────
// CÁC HÀM TIỆN ÍCH CHUẨN HÓA VÀ ĐỐI SOÁT NHÃN (UTILITY FUNCTIONS)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Xóa dấu tiếng Việt, ký tự đặc biệt, emoji để đối chiếu linh hoạt
 */
export function normalizeLabelString(str: string): string {
  if (!str) return '';
  let s = str.trim().toLowerCase();

  // Xóa emoji thông dụng
  s = s.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');

  // Xóa dấu tiếng Việt
  s = s.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, 'a');
  s = s.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, 'e');
  s = s.replace(/ì|í|ị|ỉ|ĩ/g, 'i');
  s = s.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, 'o');
  s = s.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, 'u');
  s = s.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, 'y');
  s = s.replace(/đ/g, 'd');

  // Xóa ký tự gạch chân, dấu câu, khoảng trắng thừa
  s = s.replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Làm sạch chuỗi nhãn, loại bỏ emoji thừa lồng trong chuỗi tên nhãn (để tránh hiển thị trùng lặp như 🐶 Chó 🐶)
 */
export function cleanClassLabel(label: string, emoji?: string): string {
  if (!label) return '';
  let s = label.trim();
  if (emoji) {
    s = s.replaceAll(emoji, '');
  }
  s = s.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
  return s.trim() || label.trim();
}

export interface MatchResult {
  matched: boolean;
  datasetId?: DatasetId;
  datasetNameVi?: string;
  dataset?: DatasetInfo;
  classMapping?: ClassLabelMapping;
  confidenceScore: number; // 0..1
  matchedKeyword?: string;
}

/**
 * Tìm kiếm lớp trong dataset tương ứng với nhãn do Giáo viên nhập vào
 * Hỗ trợ cả:
 * - "Chó", "chó", "Dog", "dog", "Cún", "puppy" -> Match 'dog'
 * - "Mèo", "mèo", "Cat", "cat" -> Match 'cat'
 * - "Táo", "Apple", "Quả táo" -> Match 'apple'
 * - "Lá có đốm", "Lá bệnh", "Spotted leaf" -> Match 'diseased_leaf'
 * - "Búa", "Rock", "Bao", "Paper", "Kéo", "Scissors" -> Match 'rock'/'paper'/'scissors'
 */
export function matchLabelToDataset(
  inputLabel: string,
  preferredDatasetId?: DatasetId
): MatchResult {
  if (!inputLabel) return { matched: false, confidenceScore: 0 };

  const rawInput = inputLabel.trim().toLowerCase();
  const normalizedInput = normalizeLabelString(inputLabel);

  const datasetsToSearch = preferredDatasetId
    ? ALL_DATASETS.filter((d) => d.id === preferredDatasetId)
    : ALL_DATASETS;

  // 1. Tìm kiếm khớp chính xác (Exact match)
  for (const ds of datasetsToSearch) {
    for (const c of ds.classes) {
      // Check tiếng Anh
      for (const en of c.englishNames) {
        if (en.toLowerCase() === rawInput || normalizeLabelString(en) === normalizedInput) {
          return {
            matched: true,
            datasetId: ds.id,
            datasetNameVi: ds.nameVi,
            dataset: ds,
            classMapping: c,
            confidenceScore: 1.0,
            matchedKeyword: en,
          };
        }
      }
      // Check tiếng Việt
      for (const vi of c.vietnameseNames) {
        if (vi.toLowerCase() === rawInput || normalizeLabelString(vi) === normalizedInput) {
          return {
            matched: true,
            datasetId: ds.id,
            datasetNameVi: ds.nameVi,
            dataset: ds,
            classMapping: c,
            confidenceScore: 1.0,
            matchedKeyword: vi,
          };
        }
      }
    }
  }

  // 2. Tìm kiếm khớp từng phần (Partial / substring match)
  for (const ds of datasetsToSearch) {
    for (const c of ds.classes) {
      // Nếu input chứa từ khóa hoặc từ khóa chứa input
      for (const vi of c.vietnameseNames) {
        const normVi = normalizeLabelString(vi);
        if (
          normVi.length >= 3 &&
          (normalizedInput.includes(normVi) || normVi.includes(normalizedInput))
        ) {
          return {
            matched: true,
            datasetId: ds.id,
            datasetNameVi: ds.nameVi,
            dataset: ds,
            classMapping: c,
            confidenceScore: 0.85,
            matchedKeyword: vi,
          };
        }
      }
      for (const en of c.englishNames) {
        const normEn = normalizeLabelString(en);
        if (
          normEn.length >= 3 &&
          (normalizedInput.includes(normEn) || normEn.includes(normalizedInput))
        ) {
          return {
            matched: true,
            datasetId: ds.id,
            datasetNameVi: ds.nameVi,
            dataset: ds,
            classMapping: c,
            confidenceScore: 0.85,
            matchedKeyword: en,
          };
        }
      }
    }
  }

  return { matched: false, confidenceScore: 0 };
}

/**
 * Gợi ý bộ dataset phù hợp dựa trên danh sách tất cả các nhãn mà Giáo viên đã tạo
 * Ví dụ: Tạo 2 nhãn ["Chó", "Mèo"] -> Gợi ý ngay `cats-and-dogs`
 * Tạo 3 nhãn ["Búa", "Bao", "Kéo"] -> Gợi ý ngay `rock-paper-scissors`
 */
export function detectMatchingDataset(labels: string[]): {
  datasetId: DatasetId | null;
  dataset?: DatasetInfo;
  matchedCount: number;
  totalLabels: number;
} {
  if (!labels || labels.length === 0) {
    return { datasetId: null, matchedCount: 0, totalLabels: 0 };
  }

  let bestDataset: DatasetInfo | null = null;
  let maxMatched = 0;

  for (const ds of ALL_DATASETS) {
    let matched = 0;
    for (const label of labels) {
      const res = matchLabelToDataset(label, ds.id);
      if (res.matched) matched++;
    }
    if (matched > maxMatched) {
      maxMatched = matched;
      bestDataset = ds;
    }
  }

  return {
    datasetId: bestDataset ? bestDataset.id : null,
    dataset: bestDataset || undefined,
    matchedCount: maxMatched,
    totalLabels: labels.length,
  };
}

/**
 * Danh sách gợi ý các bộ nhãn mẫu (Preset) hiển thị trên giao diện Giáo viên
 */
export const TEACHER_DATASET_PRESETS = [
  {
    id: 'agri-doctor',
    title: '🌿 Bác sĩ Nông nghiệp (3 nhãn: Lá Khỏe, Lá Bệnh, Sâu Bọ)',
    description: 'Kịch bản liên bộ dữ liệu Plant_Village + Pest_Dataset: Phân biệt lá khỏe, lá bệnh và bọ cánh cứng gây hại.',
    datasetFolder: 'Plant_Village & Pest_Dataset',
    classes: [
      { id: 'class_healthy', label: 'Lá Khỏe Mạnh', emoji: '🌿', matchKey: 'healthy_leaf' },
      { id: 'class_diseased', label: 'Lá Có Đốm Bệnh', emoji: '🍂', matchKey: 'diseased_leaf' },
      { id: 'class_pest', label: 'Bọ Cánh Cứng', emoji: '🪲', matchKey: 'beetle' },
    ],
  },
  {
    id: 'animal-world',
    title: '🐾 Thế giới Động vật (3 nhãn: Chó, Mèo, Bọ Cánh Cứng)',
    description: 'Kịch bản liên bộ dữ liệu Cats_And_Dogs + Pest_Dataset: Phân loại đa lớp sinh động giữa các loài động vật.',
    datasetFolder: 'Cats_And_Dogs & Pest_Dataset',
    classes: [
      { id: 'class_dog', label: 'Chó', emoji: '🐶', matchKey: 'dog' },
      { id: 'class_cat', label: 'Mèo', emoji: '🐱', matchKey: 'cat' },
      { id: 'class_beetle', label: 'Bọ Cánh Cứng', emoji: '🪲', matchKey: 'beetle' },
    ],
  },
  {
    id: 'cats-and-dogs',
    title: '🐶 Chó vs 🐱 Mèo (2 nhãn)',
    description: 'Bộ ảnh nhị phân phân biệt Chó và Mèo (Cats_And_Dogs_Mini_Dataset).',
    datasetFolder: 'Cats_And_Dogs_Mini_Dataset',
    classes: [
      { id: 'class_dog', label: 'Chó', emoji: '🐶', matchKey: 'dog' },
      { id: 'class_cat', label: 'Mèo', emoji: '🐱', matchKey: 'cat' },
    ],
  },
  {
    id: 'rock-paper-scissors',
    title: '✊ Búa - ✋ Bao - ✌️ Kéo (3 nhãn)',
    datasetFolder: 'Rock_Paper_Scissors_Images',
    classes: [
      { id: 'class_rock', label: 'Búa', emoji: '✊', matchKey: 'rock' },
      { id: 'class_paper', label: 'Bao', emoji: '✋', matchKey: 'paper' },
      { id: 'class_scissors', label: 'Kéo', emoji: '✌️', matchKey: 'scissors' },
    ],
  },
  {
    id: 'fruit-garden',
    title: '🍎 Vườn Trái Cây (3 nhãn: Táo, Chuối, Cam)',
    description: 'Bộ ảnh 3 loại quả phổ biến từ Fruit_Classification_10_Class.',
    datasetFolder: 'Fruit_Classification_10_Class',
    classes: [
      { id: 'class_apple', label: 'Táo', emoji: '🍎', matchKey: 'apple' },
      { id: 'class_banana', label: 'Chuối', emoji: '🍌', matchKey: 'banana' },
      { id: 'class_orange', label: 'Cam', emoji: '🍊', matchKey: 'orange' },
    ],
  },
  {
    id: 'plant-healthy-disease',
    title: '🌿 Lá Khỏe Mạnh vs 🍂 Lá Có Đốm Bệnh (2 nhãn)',
    datasetFolder: 'Plant_Village',
    classes: [
      { id: 'class_healthy', label: 'Lá Khỏe Mạnh', emoji: '🌿', matchKey: 'healthy_leaf' },
      { id: 'class_diseased', label: 'Lá Có Đốm Bệnh', emoji: '🍂', matchKey: 'diseased_leaf' },
    ],
  },
  {
    id: 'fruit-10',
    title: '🍎 10 Loại Trái Cây (Apple, Banana, Mango...)',
    datasetFolder: 'Fruit_Classification_10_Class',
    classes: [
      { id: 'class_apple', label: 'Táo', emoji: '🍎', matchKey: 'apple' },
      { id: 'class_banana', label: 'Chuối', emoji: '🍌', matchKey: 'banana' },
      { id: 'class_orange', label: 'Cam', emoji: '🍊', matchKey: 'orange' },
      { id: 'class_watermelon', label: 'Dưa Hấu', emoji: '🍉', matchKey: 'watermelon' },
      { id: 'class_avocado', label: 'Bơ', emoji: '🥑', matchKey: 'avocado' },
      { id: 'class_mango', label: 'Xoài', emoji: '🥭', matchKey: 'mango' },
      { id: 'class_strawberry', label: 'Dâu Tây', emoji: '🍓', matchKey: 'strawberry' },
      { id: 'class_pineapple', label: 'Dứa', emoji: '🍍', matchKey: 'pineapple' },
      { id: 'class_cherry', label: 'Cherry', emoji: '🍒', matchKey: 'cherry' },
      { id: 'class_kiwi', label: 'Kiwi', emoji: '🥝', matchKey: 'kiwi' },
    ],
  },
  {
    id: 'pest',
    title: '🦗 Côn Trùng & Sâu Bệnh (9 nhãn nông nghiệp)',
    datasetFolder: 'Pest_Dataset',
    classes: [
      { id: 'class_grasshopper', label: 'Châu Chấu', emoji: '🦗', matchKey: 'grasshopper' },
      { id: 'class_beetle', label: 'Bọ Cánh Cứng', emoji: '🪲', matchKey: 'beetle' },
      { id: 'class_mosquito', label: 'Muỗi', emoji: '🦟', matchKey: 'mosquito' },
      { id: 'class_aphids', label: 'Rệp Muội', emoji: '🪲', matchKey: 'aphids' },
      { id: 'class_armyworm', label: 'Sâu Keo', emoji: '🐛', matchKey: 'armyworm' },
      { id: 'class_bollworm', label: 'Sâu Đục Quả', emoji: '🐛', matchKey: 'bollworm' },
      { id: 'class_stem_borer', label: 'Sâu Đục Thân', emoji: '🐛', matchKey: 'stem_borer' },
      { id: 'class_mites', label: 'Bọ Ve / Nhện Đỏ', emoji: '🕷️', matchKey: 'mites' },
      { id: 'class_sawfly', label: 'Ong Cắn Lá', emoji: '🐝', matchKey: 'sawfly' },
    ],
  },
];
