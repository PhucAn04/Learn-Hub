import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcryptjs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);
  const userRepository = dataSource.getRepository(User);

  const email = 'admin@learnhub.com';
  const password = 'AdminPassword123!';

  let admin = await userRepository.findOne({ where: { email } });

  if (admin) {
    console.log('Admin user already exists!');
  } else {
    const hashedPassword = await bcrypt.hash(password, 10);
    admin = userRepository.create({
      username: 'System Admin',
      email,
      password: hashedPassword,
      role: 'admin',
      avatar: '👑',
      isActive: true,
    });

    await userRepository.save(admin);
    console.log('Admin user created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
  }

  await app.close();
}

bootstrap();
