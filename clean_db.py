import asyncio
import asyncpg

async def clean():
    pool = await asyncpg.create_pool('postgresql://postgres:newpassword123@localhost:5432/arca')
    await pool.execute('TRUNCATE documents, raw_circulars CASCADE')
    print('Database cleaned successfully.')

if __name__ == "__main__":
    asyncio.run(clean())
