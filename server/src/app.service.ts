import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from './modules/users/users.service';
import { seedTeacher } from './shared/database/seeds/seed-teacher';
import { seedStudent } from './shared/database/seeds/seed-student';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly usersService: UsersService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async onModuleInit() {
    await seedTeacher(this.usersService);
    await seedStudent(this.usersService);
  }
}
