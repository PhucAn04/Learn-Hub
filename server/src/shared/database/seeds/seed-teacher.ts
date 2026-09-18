import { UsersService } from '../../../modules/users/users.service';
import * as bcrypt from 'bcryptjs';

export async function seedTeacher(usersService: UsersService): Promise<void> {
  const teacherEmail = 'teacher@learnhub.com';
  const existing = await usersService.findByEmail(teacherEmail);

  if (!existing) {
    const hashedPassword = await bcrypt.hash('123456', 10);
    await usersService.create({
      username: 'Cô Giáo Mai 👩‍🏫',
      email: teacherEmail,
      password: hashedPassword,
      avatar: '👩‍🏫',
      role: 'teacher',
    });
    console.log(
      '--- SEED: Created temporary Teacher account (teacher@learnhub.com / 123456) ---',
    );
  }
}
