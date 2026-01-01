'use strict';
var express = require('express');
var cookieParser = require('cookie-parser');

var app = express();

app.use(express.json());
app.use(cookieParser());
app.set('port', 3000);

var server = app.listen(app.get('port'), function () {
    console.log('Server listening on port ' + server.address().port);
});

// Creates date with <offset> from <crrDate>
function createDate(crrDate, offset) {
    const date = new Date(crrDate);
    date.setDate(date.getDate() + offset);

    return date;
}

class EnergyMix {
    constructor() {
        this.gas = 0;
        this.coal = 0;
        this.biomass = 0;
        this.nuclear = 0;
        this.hydro = 0;
        this.imports = 0;
        this.other = 0;
        this.wind = 0;
        this.solar = 0;
        this.cleanEnergyPercent = 0;
    }

    calcAvgs(records) {
        const keys = Object.keys(this).filter(el => el != "cleanEnergyPercent");

        records.forEach(record => {
            keys.forEach(key => this[key] += record[key]);
        });

        keys.forEach(key => this[key] /= records.length);
    }

    calcCleanEnergy() {
        this.cleanEnergyPercent = this.biomass + this.nuclear + this.hydro + this.wind + this.solar;
    }
}

// Returns fetched data or undefined
async function fetchEnergyData(from, to) {
    const url = `https://api.carbonintensity.org.uk/generation/${from}/${to}`;

    return await fetch(url, {
        method: "GET"
    })
    .then(async res => {
        const d = await res.json();

        if (res.ok)
            return d.data.map(el => ({ ...el, date: el.from.split('T')[0]}));
        else
            throw new Error(`Failed to fetch (${res.status} status code)`);
    })
    .catch(err => console.log(err.message));
}

function sortByDay(data, crrDate, daysAmount) {
    const recordsByDays = {};

    for (let i = 0; i < daysAmount; i++)
        recordsByDays[createDate(crrDate, i).toISOString().split('T')[0]] = []

    data.forEach(record => {
        const mix = {};
        record.generationmix.forEach(el => mix[el.fuel] = el.perc);

        recordsByDays[record.date].push(mix);
    });

    return recordsByDays;
}


// Endpoints

app.get('/energy-mix', async (req, res) => {
    const days = 3;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const from = today.toISOString();
    const to = createDate(today, days - 1).toISOString();
    const data = await fetchEnergyData(from, to);

    if (data != undefined) {
        const recordsByDays = sortByDay(data, today, days);

        const dailyAvgs = [];
        Object.keys(recordsByDays).forEach(date => {
            const records = recordsByDays[date];

            const avg = new EnergyMix();
            const count = records.length;

            avg.calcAvgs(records);
            avg.calcCleanEnergy();

            dailyAvgs.push({
                date,
                averages: JSON.stringify(avg)
            });
        });

        return res.json({
            period: { from, to },
            days: dailyAvgs
        });
    }
    else {
        return res.status(500).json({
            error: "Internal server error"
        });
    }

});

app.get('/optimal-charging-window', async (req, res) => {
    const hours = req.query.hours;

    if (!hours || hours < 1 || hours > 6) {
        return res.status(400).json({
            error: "Hours must be set between 1 and 6"
        });
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const dayLater = createDate(today, 1);
    const threeDaysLater = createDate(dayLater, 2); 

    // it covers from tomorrow 0:00 to (tomorrow + 2 days) 0:00
    const from = dayLater.toISOString();
    const to = threeDaysLater.toISOString();
    const data = await fetchEnergyData(from, to);

    if (data != undefined) {
        const intervals = hours * 2;
        let bestWindow = null;
        let maxCleanEnergy = -1;

        for (let i = 0; i <= data.length - intervals; i++) {
            const window = data.slice(i, i + intervals);

            let sum = 0;
            window.forEach(record => {
                record.generationmix
                    .filter(item => ['biomass', 'nuclear', 'hydro', 'wind', 'solar'].includes(item.fuel))
                    .forEach(fuel => sum += fuel.perc);
            });

            const avg = sum / window.length;
            if (avg > maxCleanEnergy) {
                maxCleanEnergy = avg;
                bestWindow = {
                    start: window[0].from,
                    end: window[window.length - 1].to,
                    avgCleanEnergy: avg
                };
            }
        }

        return res.json({
            hours,
            optimalWindow: {
                startTime: bestWindow.start,
                endTime: bestWindow.end,
                averageCleanEnergyPercent: Math.round(maxCleanEnergy * 100) / 100
            }
        });
    }
    else {
        return res.status(500).json({
            error: "Internal server error"
        });
    }
});


module.exports = {
    app,
    createDate,
    EnergyMix
};
