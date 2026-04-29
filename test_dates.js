let daysBack = 180;
let currentDaysBack = daysBack;
while (currentDaysBack > 175) {
    let chunkDays = 1;
    const toDate = new Date();
    toDate.setDate(toDate.getDate() - (daysBack - currentDaysBack));
    console.log("daysBack:", daysBack, "currentDaysBack:", currentDaysBack, "->", toDate.toISOString());
    currentDaysBack--;
}
