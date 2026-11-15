const MemoryRepository = require('../../src/repositories/memory/memoryRepository');

describe('MemoryRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new MemoryRepository();
  });

  it('creates and retrieves a profile', async () => {
    const profile = await repo.createProfile({
      elderName: 'Alice',
      elderEmail: 'alice@test.com'
    });
    expect(profile.id).toBeDefined();
    expect(profile.elderName).toBe('Alice');

    const fetched = await repo.getProfile(profile.id);
    expect(fetched).toEqual(profile);
  });

  it('creates, retrieves, and updates members', async () => {
    const profile = await repo.createProfile({ elderName: 'Bob', elderEmail: 'bob@test.com' });
    const member = await repo.createMember(profile.id, {
      name: 'Bob',
      email: 'bob@test.com',
      role: 'elder',
      passcodeHash: 'hash123',
      permissions: { canViewMeds: true }
    });

    expect(member.id).toBeDefined();

    const byEmail = await repo.getMemberByEmail(profile.id, 'bob@test.com');
    expect(byEmail.id).toBe(member.id);

    const updated = await repo.updateMember(profile.id, member.id, { failedLoginAttempts: 3 });
    expect(updated.failedLoginAttempts).toBe(3);
  });

  it('creates, lists, and deletes medications', async () => {
    const profile = await repo.createProfile({ elderName: 'Charlie', elderEmail: 'c@test.com' });
    const med = await repo.createMedication(profile.id, {
      name: 'Aspirin',
      dosage: '81mg',
      active: true
    });

    const list = await repo.listMedications(profile.id);
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('Aspirin');

    const deleted = await repo.deleteMedication(profile.id, med.id);
    expect(deleted).toBe(true);

    const emptyList = await repo.listMedications(profile.id);
    expect(emptyList.length).toBe(0);
  });
});
