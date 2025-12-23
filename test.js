const request = require('supertest');
const { app, createDate, EnergyMix } = require('./app');

describe('Energy API Endpoints', () => {
    describe('GET /energy-mix', () => {
        it('must return energy mix data (with proper structure) for 3 days', async () => {
            const response = await request(app)
                .get('/energy-mix')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('period');
            expect(response.body).toHaveProperty('days');
            expect(response.body.days).toHaveLength(3);

            response.body.days.forEach(day => {
                expect(day).toHaveProperty('date');
                expect(day).toHaveProperty('averages');

                const averages = JSON.parse(day.averages);
                expect(averages).toHaveProperty('cleanEnergyPercent');
                expect(typeof averages.cleanEnergyPercent).toBe('number');
            });
        });

        it('must handle server errors', async () => {
            const originalFetch = global.fetch;
            global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));

            const response = await request(app)
                .get('/energy-mix')
                .expect(500);

            expect(response.body).toHaveProperty('error');

            global.fetch = originalFetch; 
        });
    });

    describe('GET /optimal-charging-window', () => {
        it('must return optimal window  (with proper and valid structure)', async () => {
            const response = await request(app)
                .get('/optimal-charging-window?hours=3')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveProperty('hours');
            expect(parseInt(response.body.hours)).toBe(3);
            expect(response.body).toHaveProperty('optimalWindow');
            expect(response.body.optimalWindow).toHaveProperty('startTime');
            expect(response.body.optimalWindow).toHaveProperty('endTime');
            expect(response.body.optimalWindow).toHaveProperty('averageCleanEnergyPercent');
            expect(typeof response.body.optimalWindow.averageCleanEnergyPercent).toBe('number');
        });

        it('must return 400 for hours less than 1', async () => {
            const response = await request(app)
                .get('/optimal-charging-window?hours=0')
                .expect(400);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toContain('Hours must be set between 1 and 6');
        });

        it('must return 400 for hours greater than 6', async () => {
            const response = await request(app)
                .get('/optimal-charging-window?hours=7')
                .expect(400);

            expect(response.body.error).toContain('Hours must be set between 1 and 6');
        });

        it('must return 400 when hours parameter is missing', async () => {
            const response = await request(app)
                .get('/optimal-charging-window')
                .expect(400);

            expect(response.body).toHaveProperty('error');
        });
    });
});

describe('Helper Functions', () => {
    test('createDate must create date with offset', () => {
        const testDate = new Date('2025-12-01');
        const result = createDate(testDate, 5);

        const expected = new Date('2025-12-06');
        expect(result.toISOString().split('T')[0]).toBe(expected.toISOString().split('T')[0]);
    });

    test('EnergyMix class must calculate averages correctly', () => {
        const energyMix = new EnergyMix();
        const mockRecords = [
            { gas: 10, coal: 20, biomass: 30, nuclear: 40, hydro: 50, imports: 60, other: 70, wind: 80, solar: 90 },
            { gas: 20, coal: 30, biomass: 40, nuclear: 50, hydro: 60, imports: 70, other: 80, wind: 90, solar: 100 }
        ];

        energyMix.calcAvgs(mockRecords);

        expect(energyMix.gas).toBe(15); 
        expect(energyMix.coal).toBe(25);
        expect(energyMix.solar).toBe(95);
    });

    test('EnergyMix must calculate clean energy percentage', () => {
        const energyMix = new EnergyMix();
        energyMix.biomass = 10;
        energyMix.nuclear = 20;
        energyMix.hydro = 30;
        energyMix.wind = 40;
        energyMix.solar = 50;
        // Following ones must be excluded from the sum
        energyMix.gas = 11; 
        energyMix.coal = 12;
        energyMix.imports = 13;
        energyMix.other = 14;

        energyMix.calcCleanEnergy();
        expect(energyMix.cleanEnergyPercent).toBe(150);
    });
});