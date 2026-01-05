import { config } from 'dotenv';
config(); // 加载 .env 文件

import { PrismaClient } from '@prisma/client';
import { randomBytes, pbkdf2 } from 'crypto';

const prisma = new PrismaClient();

// 使用与系统相同的哈希方法
async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString('hex');
    pbkdf2(password, salt, 1000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      resolve('pbkdf2:' + salt + ':' + derivedKey.toString('hex'));
    });
  });
}

async function main() {
  const username = process.argv[2] || 'devin';
  const password = process.argv[3] || '523450';
  
  const hashedPassword = await hashPassword(password);
  
  // 检查用户是否存在
  const existing = await prisma.accounts.findFirst({
    where: { name: username }
  });
  
  if (existing) {
    // 更新密码和角色
    await prisma.accounts.update({
      where: { id: existing.id },
      data: { 
        password: hashedPassword,
        role: 'superadmin'  // 确保角色是 superadmin
      }
    });
    console.log(`用户 ${username} 密码已更新，角色已设为 superadmin`);
  } else {
    // 创建新用户
    await prisma.accounts.create({
      data: {
        name: username,
        nickname: username,
        password: hashedPassword,
        role: 'superadmin',
      }
    });
    console.log(`用户 ${username} 已创建`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
