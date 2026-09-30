import { UsersService } from '../../../modules/users/users.service';
import * as bcrypt from 'bcryptjs';

export async function seedAdmin(usersService: UsersService): Promise<void> {
  const adminEmail = 'admin@learnhub.com';
  const existing = await usersService.findByEmail(adminEmail);

  if (!existing) {
    const hashedPassword = await bcrypt.hash('AdminPassword123!', 10);
    await usersService.create({
      username: 'System Admin',
      email: adminEmail,
      password: hashedPassword,
      avatar: '🛡️',
      role: 'admin',
      isActive: true,
    });
  }
}
