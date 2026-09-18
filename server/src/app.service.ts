import { Injectable, OnModuleInit } from '@nestjs/common';
import { UsersService } from './modules/users/users.service';
import { seedTeacher } from './shared/database/seeds/seed-teacher';
import { seedStudent } from './shared/database/seeds/seed-student';
import { seedAdmin } from './shared/database/seeds/seed-admin';

@Injectable()
export class AppService implements OnModuleInit {
  constructor(private readonly usersService: UsersService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async onModuleInit() {
    await seedTeacher(this.usersService);
    await seedStudent(this.usersService);
    await seedAdmin(this.usersService);
  }
}
