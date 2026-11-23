/**
 * NovaPulse Hiring CRM - SheetRepo
 * Generic repository pattern module for Google Sheets access
 * 
 * Rules:
 * - Never rename, reorder, insert, or delete columns or tabs.
 * - Always look up columns BY HEADER NAME, not by fixed index.
 * - Header row = row 1 on all tabs except OPENINGS (row 4 = headers, data starts row 5).
 * - Read-only tabs: MANAGEMENT DASHBOARD, DASHBOARD, INTERVIEW REPORT, JOINING REPORT,
 *   CANDIDATE SEARCH, ACCESS CONTROL REPORT, _DASH DATA, _SYNC STATE
 */

var SheetRepo = (function () {
  var READ_ONLY_TABS = [
    'MANAGEMENT DASHBOARD',
    'DASHBOARD',
    'INTERVIEW REPORT',
    'JOINING REPORT',
    'CANDIDATE SEARCH',
    'ACCESS CONTROL REPORT',
    '_DASH DATA',
    '_SYNC STATE',
    'FORM RESPONSES (RAW)',
    'MD OLD'
  ];

  function getSpreadsheet() {
    // If bound to sheet, use getActiveSpreadsheet(); otherwise fallback to configured ID
    try {
      var active = SpreadsheetApp.getActiveSpreadsheet();
      if (active) return active;
    } catch (e) {
      // not running in container-bound context
    }
    var configId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!configId) {
      configId = '11j17e5RTG0uLTXg41f_AfKMqAUtGCDXV2DusZ8Muq58'; // default production ID
    }
    return SpreadsheetApp.openById(configId);
  }

  function getHeaderRowNumber(tabName) {
    if (tabName === 'OPENINGS') return 4;
    return 1;
  }

  function getDataStartRowNumber(tabName) {
    if (tabName === 'OPENINGS') return 5;
    return 2;
  }

  function getSheet(tabName) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) {
      throw new Error('Tab not found in spreadsheet: ' + tabName);
    }
    return sheet;
  }

  /**
   * Returns a map of Header Name -> Column 1-based Index
   */
  function getHeaderMap(sheet, tabName) {
    var headerRowNum = getHeaderRowNumber(tabName);
    var lastCol = sheet.getLastColumn();
    if (lastCol < 1) return { map: {}, list: [] };

    var headerValues = sheet.getRange(headerRowNum, 1, 1, lastCol).getDisplayValues()[0];
    var map = {};
    var list = [];
    for (var i = 0; i < headerValues.length; i++) {
      var header = (headerValues[i] || '').trim();
      if (header) {
        map[header] = i + 1; // 1-based index
        list.push(header);
      }
    }
    return { map: map, list: list };
  }

  /**
   * Generic readTable: returns array of row objects
   */
  function readTable(tabName, options) {
    options = options || {};
    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var startRow = getDataStartRowNumber(tabName);
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();

    if (lastRow < startRow || lastCol < 1) {
      return [];
    }

    var numRows = lastRow - startRow + 1;
    // Use getDisplayValues to preserve formatted strings, dates, leading zeroes, phone numbers
    var range = sheet.getRange(startRow, 1, numRows, lastCol);
    var displayValues = range.getDisplayValues();
    var rawValues = (options.useRawValues) ? range.getValues() : null;

    var rows = [];
    for (var r = 0; r < displayValues.length; r++) {
      var rowObj = {};
      var isEmpty = true;
      for (var h = 0; h < headerInfo.list.length; h++) {
        var header = headerInfo.list[h];
        var colIdx = headerInfo.map[header] - 1;
        var val = rawValues ? rawValues[r][colIdx] : displayValues[r][colIdx];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          isEmpty = false;
        }
        rowObj[header] = val !== undefined && val !== null ? val : '';
      }

      if (!isEmpty) {
        // Attach 1-based sheet row index for fast targeted updates
        rowObj._rowIndex = startRow + r;
        if (!options.filter || options.filter(rowObj)) {
          rows.push(rowObj);
        }
      }
    }

    if (options.limit && options.limit > 0) {
      var offset = options.offset || 0;
      return rows.slice(offset, offset + options.limit);
    }
    return rows;
  }

  /**
   * Generic findRow: returns matching row object with _rowIndex or null
   */
  function findRow(tabName, keyHeader, value) {
    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var colIndex = headerInfo.map[keyHeader];
    if (!colIndex) {
      throw new Error('Key header "' + keyHeader + '" not found in tab: ' + tabName);
    }

    var startRow = getDataStartRowNumber(tabName);
    var lastRow = sheet.getLastRow();
    if (lastRow < startRow) return null;

    var numRows = lastRow - startRow + 1;
    var columnValues = sheet.getRange(startRow, colIndex, numRows, 1).getDisplayValues();

    var targetValStr = String(value).trim();
    for (var i = 0; i < columnValues.length; i++) {
      if (String(columnValues[i][0]).trim() === targetValStr) {
        var targetRowIndex = startRow + i;
        var rowRange = sheet.getRange(targetRowIndex, 1, 1, sheet.getLastColumn());
        var rowValues = rowRange.getDisplayValues()[0];
        var rowObj = { _rowIndex: targetRowIndex };
        for (var h = 0; h < headerInfo.list.length; h++) {
          var header = headerInfo.list[h];
          var idx = headerInfo.map[header] - 1;
          rowObj[header] = rowValues[idx] || '';
        }
        return rowObj;
      }
    }
    return null;
  }

  /**
   * Generic appendRow: appends an object matching tab headers
   */
  function appendRow(tabName, obj) {
    if (READ_ONLY_TABS.indexOf(tabName) !== -1) {
      throw new Error('Tab ' + tabName + ' is read-only and cannot be modified.');
    }

    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var lastCol = sheet.getLastColumn();
    var rowValues = [];

    for (var c = 1; c <= lastCol; c++) {
      // Find header for this column index
      var colHeader = null;
      for (var h = 0; h < headerInfo.list.length; h++) {
        if (headerInfo.map[headerInfo.list[h]] === c) {
          colHeader = headerInfo.list[h];
          break;
        }
      }
      var val = (colHeader && obj[colHeader] !== undefined) ? obj[colHeader] : '';
      rowValues.push(val);
    }

    sheet.appendRow(rowValues);
    var newRowIndex = sheet.getLastRow();
    obj._rowIndex = newRowIndex;
    return { success: true, rowIndex: newRowIndex, data: obj };
  }

  /**
   * Generic updateRow: updates only fields specified in patch by matching keyHeader = value
   */
  function updateRow(tabName, keyHeader, value, patch) {
    if (READ_ONLY_TABS.indexOf(tabName) !== -1) {
      throw new Error('Tab ' + tabName + ' is read-only and cannot be modified.');
    }

    var sheet = getSheet(tabName);
    var headerInfo = getHeaderMap(sheet, tabName);
    var existing = findRow(tabName, keyHeader, value);
    if (!existing) {
      throw new Error('Record not found in tab ' + tabName + ' where ' + keyHeader + ' = ' + value);
    }

    var rowIndex = existing._rowIndex;
    for (var patchField in patch) {
      if (!patch.hasOwnProperty(patchField)) continue;
      if (patchField.startsWith('_')) continue; // skip internal metadata fields

      var colIndex = headerInfo.map[patchField];
      if (colIndex) {
        var newVal = patch[patchField];
        sheet.getRange(rowIndex, colIndex).setValue(newVal !== undefined && newVal !== null ? newVal : '');
      }
    }

    return { success: true, rowIndex: rowIndex, updatedFields: patch };
  }

  return {
    getSpreadsheet: getSpreadsheet,
    getSheet: getSheet,
    getHeaderMap: getHeaderMap,
    readTable: readTable,
    findRow: findRow,
    appendRow: appendRow,
    updateRow: updateRow,
    READ_ONLY_TABS: READ_ONLY_TABS
  };
})();
