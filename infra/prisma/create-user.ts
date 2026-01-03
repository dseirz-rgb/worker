import { PrismaClient } from '@prisma/client';
import { randomBytes, pbkdf2 } from 'crypto';

async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve('pbkdf2:' + salt + ':' + derivedKey.toString('hex'));
    });
  });
}

// 使用 DIRECT_URL 直连
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL
    }
  }
});

async function main() {
  const username = 'devin';
  const password = '523450';
  
  // 检查用户是否存在
  const existing = await prisma.accounts.findFirst({
    where: { name: username }
  });
  
  if (existing) {
    console.log('User already exists, updating password...');
    const hashedPassword = await hashPassword(password);
    await prisma.accounts.update({
      where: { id: existing.id },
      data: { password: hashedPassword }
    });
    console.log('Password updated for user:', username);
    return;
  }
  
  // 创建新用户
  const hashedPassword = await hashPassword(password);
  const user = await prisma.accounts.create({
    data: {
      name: username,
      password: hashedPassword,
      role: 'superadmin',
      nickname: 'Devin'
    }
  });
  
  console.log('User created:', user.id, user.name);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
