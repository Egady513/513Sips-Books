/* 513Sips calculator pricing. Pure math, no DOM.
   Browser: window.Sips513Pricing. Node: globalThis.Sips513Pricing. */
(function (root) {
    'use strict';

    var BASE_PRICE = 750;
    var SMALL_GROUP_PRICE = 395;
    var HOURLY_RATE = 75;
    var FULL_BAR_HOURLY = 15;
    var LONG_EVENT_PREMIUM = 15;
    var LONG_EVENT_PREMIUM_START_HOUR = 5;
    var HOUSE_COCKTAIL_RATE = 50;
    var COCKTAIL_PROGRAM_EXPANDED = 250;
    var COCKTAIL_PROGRAM_EXTENSIVE = 500;
    var GLASSWARE_RATE = 3.5;
    var LOGO_ICE_RATE = 3;
    var FIRST_EXTRA_BAR = 225;
    var EACH_LATER_BAR = 150;

    var PROCUREMENT_TIERS = [
        { max: 99, fee: 175 },
        { max: 150, fee: 275 },
        { max: 199, fee: 350 },
        { max: 250, fee: 400 },
        { max: Infinity, fee: null }
    ];

    function procurementFee(guests) {
        for (var i = 0; i < PROCUREMENT_TIERS.length; i++) {
            if (guests <= PROCUREMENT_TIERS[i].max) return PROCUREMENT_TIERS[i].fee;
        }
        return null;
    }

    // First extra bar $225, each one after $150. One bar is $0.
    function barCharge(barCount) {
        var n = Math.max(1, Math.floor(Number(barCount)) || 1);
        if (n <= 1) return 0;
        return FIRST_EXTRA_BAR + (n - 2) * EACH_LATER_BAR;
    }

    // Stacks with the bar charge.
    function volumeCharge(guests) {
        if (guests > 150) return 400;
        if (guests > 100) return 300;
        if (guests > 50) return 175;
        return 0;
    }

    function signatureRate(guests) {
        if (guests > 150) return 175;
        if (guests > 75) return 150;
        return 125;
    }

    // A saved breakdown or config from before the bar count: a true flag or a positive amount means 2 bars.
    function legacyBarCount(value) {
        if (value === true) return 2;
        if (typeof value === 'number' && value > 0) return 2;
        return 1;
    }

    function calculatePricing(input) {
        var i = input || {};
        var guests = Number(i.guests) || 50;
        var hours = Number(i.hours) || 3;
        var bartenders = Number(i.bartenders) || 1;
        var fullBarStaffCount = Math.min(bartenders, Number(i.fullBarStaffCount) || bartenders);
        var barCount = Math.max(1, Math.floor(Number(i.barCount)) || 1);
        var distance = Number(i.distance) || 0;
        var glassCount = Number(i.glassCount) || 0;
        var signatureCount = Number(i.signatureCount) || 0;
        var houseCount = Number(i.houseCount) || 0;
        var featured = signatureCount + houseCount;
        var smallGroup = !!i.smallGroup;
        var baseHours = smallGroup ? 2 : 3;

        var b = {
            base: smallGroup ? SMALL_GROUP_PRICE : BASE_PRICE,
            staffing: 0, volume: 0, multiBarOperations: 0, barCount: barCount,
            twoHrReduction: 0, extraHours: 0, longEventPremium: 0, travel: 0, package: 0,
            glassware: 0, glasswareAtCost: false, cocktails: 0, signatureRate: signatureRate(guests),
            houseCocktails: 0, cocktailProgram: 0,
            addons: 0, addonsList: [], addonItems: [], procurementCustom: false
        };

        function addPricedAddon(name, amount) {
            b.addons += amount;
            b.addonsList.push(name);
            b.addonItems.push({ name: name, amount: amount });
        }

        if (bartenders > 1) b.staffing = (bartenders - 1) * HOURLY_RATE * baseHours;
        b.volume = volumeCharge(guests);
        b.multiBarOperations = barCharge(barCount);

        if (hours < baseHours && !smallGroup) b.twoHrReduction = (baseHours - hours) * HOURLY_RATE * bartenders;
        if (hours > baseHours) b.extraHours = (hours - baseHours) * HOURLY_RATE * bartenders;
        var premiumHours = Math.max(0, hours - LONG_EVENT_PREMIUM_START_HOUR + 1);
        b.longEventPremium = premiumHours * LONG_EVENT_PREMIUM * bartenders;

        if (distance > 30) b.travel = Math.round((distance - 30) * 0.67 * 2);
        if (i.packageType === 'fullbar') b.package = FULL_BAR_HOURLY * hours * fullBarStaffCount;

        if (i.glassware === 'plastic_at_cost') b.glasswareAtCost = true;
        else if (i.glassware === 'formal') b.glassware = Math.round(glassCount * GLASSWARE_RATE);

        if (signatureCount > 0) b.cocktails = signatureCount * b.signatureRate;
        if (houseCount > 0) b.houseCocktails = houseCount * HOUSE_COCKTAIL_RATE;
        if (featured >= 8) b.cocktailProgram = COCKTAIL_PROGRAM_EXTENSIVE;
        else if (featured >= 5) b.cocktailProgram = COCKTAIL_PROGRAM_EXPANDED;

        if (i.alcoholProcurement) {
            var fee = procurementFee(guests);
            if (fee === null) b.procurementCustom = true;
            else addPricedAddon('Alcohol Procurement & Return Service', fee);
        }
        if (i.coffeeService) addPricedAddon('Coffee Service', 100);
        if (i.archBackdrop) addPricedAddon('Arch Backdrop', 350);
        if (i.drinkBigIce) {
            var cubes = Number(i.iceCount) || 0;
            if (cubes > 0) addPricedAddon('Custom Logo Ice (' + cubes + ' cubes)', cubes * LOGO_ICE_RATE);
        }
        if (i.tentRental) addPricedAddon('Tent Rental', 250);

        var customItemsTotal = Number(i.customItemsTotal) || 0;
        var subtotal = b.base + b.staffing + b.volume + b.multiBarOperations +
            b.extraHours + b.longEventPremium - b.twoHrReduction +
            b.travel + b.package + b.glassware + b.cocktails + b.houseCocktails +
            b.cocktailProgram + b.addons + customItemsTotal;

        var discount = 0;
        var promo = i.promo;
        if (promo) discount = promo.type === 'percent' ? Math.round(subtotal * promo.value) : promo.value;
        var customDiscount = 0;
        var customPromo = i.customPromo;
        if (customPromo) {
            customDiscount = customPromo.type === 'percent'
                ? Math.round((subtotal - discount) * customPromo.value) : customPromo.value;
        }

        b.discount = discount;
        b.customDiscount = customDiscount;
        b.customItemsTotal = customItemsTotal;
        return { breakdown: b, subtotal: subtotal, total: subtotal - discount - customDiscount };
    }

    root.Sips513Pricing = {
        calculatePricing: calculatePricing,
        barCharge: barCharge,
        volumeCharge: volumeCharge,
        signatureRate: signatureRate,
        legacyBarCount: legacyBarCount,
        procurementFee: procurementFee
    };
})(typeof window !== 'undefined' ? window : globalThis);
