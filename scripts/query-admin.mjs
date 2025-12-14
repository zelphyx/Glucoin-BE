import { PrismaClient } from '@glucoin/prisma';

const prisma = new PrismaClient();

async function main(){
  try{
    const user = await prisma.user.findUnique({ where: { email: 'admin@glucoin.com' } });
    console.log(JSON.stringify(user, null, 2));
  } catch(e){
    console.error('Error querying admin:', e);
  } finally{
    await prisma.$disconnect();
  }
}

main();
