import { UsersService } from '../../../modules/users/users.service';
import * as bcrypt from 'bcryptjs';

export async function seedStudent(usersService: UsersService): Promise<void> {
  const studentEmail = 'student@learnhub.com';
  const existing = await usersService.findByEmail(studentEmail);

  if (!existing) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    await usersService.create({
      username: 'Phúc Ân 🦁',
      email: studentEmail,
      password: hashedPassword,
      avatar: '🦁',
      role: 'student',
    });
    console.log(
      '--- SEED: Created temporary Student account (student@learnhub.com / 123456) ---',
    );
  }
}
