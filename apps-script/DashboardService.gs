/**
 * NovaPulse Hiring CRM - DashboardService
 * Computes recruitment funnels, leaderboards, revenue metrics,
 * and calling analytics directly from raw tabs.
 */

var DashboardService = (function () {
  function getDashboardMetrics(user, monthFilter) {
    var candidates = SheetRepo.readTable('MASTER DATA');
    var joinings = SheetRepo.readTable('JOINING TRACKER');
    var rescheduleRows = SheetRepo.readTable('RESCHEDULE TRACKER');

    var now = new Date();
    var currentMonthStr = Utilities.formatDate(now, Utils.TIMEZONE, 'MMM-yyyy');
    var targetMonthStr = monthFilter || currentMonthStr;

    // Filter by HR if role is HR
    var isHR = (user.role === 'HR');
    var hrEmailLower = user.email.toLowerCase();

    if (isHR) {
      candidates = candidates.filter(function (c) {
        return String(c['HR Email'] || '').toLowerCase() === hrEmailLower;
      });
      joinings = joinings.filter(function (j) {
        return String(j['Assigned HR'] || '').toLowerCase() === user.name.toLowerCase();
      });
    }

    // Active records only
    candidates = candidates.filter(function (c) {
      var s = String(c['Record Status'] || 'Active').toLowerCase();
      return s !== 'inactive' && s !== 'archived';
    });

    // Funnel counts
    var funnel = {
      sourced: 0,
      connected: 0,
      interested: 0,
      interviewScheduled: 0,
      interviewAttended: 0,
      selected: 0,
      joined: 0
    };

    var todayStr = Utils.formatDate(now);
    var callsToday = 0;
    var interviewsToday = 0;
    var interviewsThisWeek = 0;
    var selectionsThisMonth = 0;
    var joiningsThisMonth = 0;

    var dropReasons = {};
    var clientCounts = {};
    var sourceCounts = {};
    var hrStats = {};

    var today = new Date();
    today.setHours(0, 0, 0, 0);

    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      funnel.sourced++;

      var connect = c['Connect Status'] || '';
      var disp = c['Calling Disposition'] || '';
      var subDisp = c['Sub-Disposition'] || '';
      var intStatus = c['Interview Status'] || '';
      var intDateStr = c['Interview Date'] || '';
      var selStatus = c['Selection Status'] || '';
      var joinStatus = c['Joining Status'] || '';
      var joinDateStr = c['Joining Date'] || '';
      var hrName = c['Assigned HR'] || 'Unassigned';
      var client = c['Client Name'] || 'Unassigned';
      var source = c['Source'] || 'Other';
      var lastUpdated = c['Last Updated'] || '';

      // Tally HR stats
      if (!hrStats[hrName]) {
        hrStats[hrName] = {
          hrName: hrName,
          sourced: 0,
          connected: 0,
          interviews: 0,
          selected: 0,
          joined: 0
        };
      }
      hrStats[hrName].sourced++;

      // Connected
      if (connect === 'Connect' || connect === 'Connected' || disp || intDateStr || selStatus || joinStatus) {
        funnel.connected++;
        hrStats[hrName].connected++;
      }

      // Interested
      if (disp === 'Interested' || disp === 'Interview Schedule' || intDateStr || selStatus || joinStatus) {
        funnel.interested++;
      }

      // Interview Scheduled
      if (intDateStr && intDateStr.trim() !== '' && intDateStr.trim() !== '-') {
        funnel.interviewScheduled++;
        hrStats[hrName].interviews++;

        var iDate = new Date(intDateStr);
        iDate.setHours(0, 0, 0, 0);
        var diffDays = Math.round((iDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) interviewsToday++;
        if (diffDays >= 0 && diffDays <= 7) interviewsThisWeek++;
      }

      // Interview Attended
      if (intStatus === 'Attended' || selStatus || joinStatus) {
        funnel.interviewAttended++;
      }

      // Selected
      if (selStatus === 'Selected') {
        funnel.selected++;
        hrStats[hrName].selected++;
        selectionsThisMonth++;
      }

      // Joined
      if (joinStatus === 'Joined') {
        funnel.joined++;
        hrStats[hrName].joined++;
        joiningsThisMonth++;
      }

      // Calls today
      if (lastUpdated && lastUpdated.indexOf(todayStr) === 0) {
        callsToday++;
      }

      // Drop reasons
      if (disp === 'Not Interested' || disp === 'Not Connected' || intStatus === 'Drop After Lineup') {
        var reason = subDisp || disp || 'Unknown';
        dropReasons[reason] = (dropReasons[reason] || 0) + 1;
      }

      // Client distribution
      if (client) {
        clientCounts[client] = (clientCounts[client] || 0) + 1;
      }

      // Source distribution
      if (source) {
        sourceCounts[source] = (sourceCounts[source] || 0) + 1;
      }
    }

    // Revenue calculations from JOINING TRACKER
    var totalRevenue = 0;
    var pendingInvoiceAmount = 0;
    var receivedRevenue = 0;

    for (var j = 0; j < joinings.length; j++) {
      var amount = parseFloat(joinings[j]['Invoice Amount']) || 0;
      var invStatus = String(joinings[j]['Invoice Status'] || '').toLowerCase();
      totalRevenue += amount;
      if (invStatus === 'paid') {
        receivedRevenue += amount;
      } else {
        pendingInvoiceAmount += amount;
      }
    }

    // Conversion rates
    var conversionRates = {
      sourcedToConnected: funnel.sourced ? Math.round((funnel.connected / funnel.sourced) * 100) : 0,
      connectedToInterested: funnel.connected ? Math.round((funnel.interested / funnel.connected) * 100) : 0,
      interestedToInterview: funnel.interested ? Math.round((funnel.interviewScheduled / funnel.interested) * 100) : 0,
      interviewToAttended: funnel.interviewScheduled ? Math.round((funnel.interviewAttended / funnel.interviewScheduled) * 100) : 0,
      attendedToSelected: funnel.interviewAttended ? Math.round((funnel.selected / funnel.interviewAttended) * 100) : 0,
      selectedToJoined: funnel.selected ? Math.round((funnel.joined / funnel.selected) * 100) : 0,
      overallConversion: funnel.sourced ? Math.round((funnel.joined / funnel.sourced) * 100 * 10) / 10 : 0
    };

    // Convert objects to sorted arrays
    var leaderboard = [];
    for (var hr in hrStats) {
      leaderboard.push(hrStats[hr]);
    }
    leaderboard.sort(function (a, b) { return b.joined - a.joined || b.interviews - a.interviews; });

    var dropReasonsList = [];
    for (var r in dropReasons) {
      dropReasonsList.push({ reason: r, count: dropReasons[r] });
    }
    dropReasonsList.sort(function (a, b) { return b.count - a.count; });

    var clientBreakdown = [];
    for (var cl in clientCounts) {
      clientBreakdown.push({ client: cl, count: clientCounts[cl] });
    }
    clientBreakdown.sort(function (a, b) { return b.count - a.count; });

    var sourceBreakdown = [];
    for (var s in sourceCounts) {
      sourceBreakdown.push({ source: s, count: sourceCounts[s] });
    }
    sourceBreakdown.sort(function (a, b) { return b.count - a.count; });

    return {
      funnel: funnel,
      conversionRates: conversionRates,
      quickStats: {
        totalCandidates: candidates.length,
        callsToday: callsToday,
        interviewsToday: interviewsToday,
        interviewsThisWeek: interviewsThisWeek,
        selectionsThisMonth: selectionsThisMonth,
        joiningsThisMonth: joiningsThisMonth,
        totalRevenue: totalRevenue,
        pendingInvoiceAmount: pendingInvoiceAmount,
        receivedRevenue: receivedRevenue
      },
      leaderboard: leaderboard,
      dropReasons: dropReasonsList,
      clientBreakdown: clientBreakdown.slice(0, 10),
      sourceBreakdown: sourceBreakdown
    };
  }

  return {
    getDashboardMetrics: getDashboardMetrics
  };
})();
