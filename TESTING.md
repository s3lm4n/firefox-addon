# Manual Testing Guide for Firefox Addon Fixes

## Overview
This document outlines manual testing procedures for the three critical bug fixes implemented:
1. picker.js - Manual Element Selector
2. debug.html - Debug Console
3. popup.js - Price Listing

## Prerequisites
- Firefox Browser (version 109.0 or higher)
- Firefox addon loaded in developer mode
- Multiple test websites with product pages

## Test 1: picker.js - Manual Element Selector

### Test 1.1: Basic Element Selection
**Objective:** Verify that the manual element selector works correctly

**Steps:**
1. Open Firefox and navigate to any e-commerce website (e.g., Amazon, eBay)
2. Click the browser extension icon
3. Click "Manuel Seçici" button
4. Observe that:
   - Dark overlay appears
   - Hint message displays at top: "🎯 Fiyat içeren öğeyi seçin • ESC ile iptal"
   - Hover over elements shows blue highlight
   - Tooltip follows cursor showing element text preview

**Expected Results:**
- ✅ Overlay displays correctly
- ✅ Hint message is visible
- ✅ Elements highlight on hover
- ✅ Tooltip updates with element content
- ✅ No console errors about 'hint' being undefined

### Test 1.2: Element Selection and Confirmation
**Objective:** Verify element selection and selector generation

**Steps:**
1. While in picker mode, hover over a price element
2. Click the price element
3. Verify confirmation panel appears showing:
   - Element content
   - Extracted price
   - HTML tag
   - CSS selector
4. Click "Onayla" button

**Expected Results:**
- ✅ Confirmation panel displays all information
- ✅ Selector is generated correctly (no errors in console)
- ✅ Success message displays
- ✅ Picker cleans up properly after 2 seconds

### Test 1.3: Error Handling
**Objective:** Test error scenarios

**Steps:**
1. Activate picker on a page with complex DOM structure
2. Try selecting various elements (buttons, divs, spans)
3. Check browser console for errors
4. Press ESC to cancel

**Expected Results:**
- ✅ No uncaught errors in console
- ✅ Selector generation handles edge cases
- ✅ ESC key properly cancels and cleans up
- ✅ Memory leaks prevented (no lingering event listeners)

### Test 1.4: Cleanup Verification
**Objective:** Verify proper cleanup prevents memory leaks

**Steps:**
1. Activate picker multiple times in succession
2. Cancel with ESC each time
3. Check that only one instance runs at a time
4. Verify no duplicate overlays or tooltips

**Expected Results:**
- ✅ Multiple activations prevented by __PRICE_PICKER_ACTIVE__ flag
- ✅ All DOM elements removed after cleanup
- ✅ Event listeners properly removed
- ✅ No memory leaks

## Test 2: debug.html - Debug Console

### Test 2.1: Console Opening
**Objective:** Verify debug console opens correctly

**Steps:**
1. Click extension icon to open popup
2. Click "Debug" button (🔧 icon)
3. Verify debug console opens in new tab

**Expected Results:**
- ✅ Debug console opens in new tab
- ✅ Initial log message displays: "Debug console başlatıldı"
- ✅ No browser API errors in console

### Test 2.2: Stats Refresh
**Objective:** Test refreshStats function

**Steps:**
1. In debug console, click "Yenile" (Refresh) button
2. Observe console output
3. Check that stats update without errors

**Expected Results:**
- ✅ Stats refresh completes successfully
- ✅ Log message shows updated stats
- ✅ No errors about browser.runtime being undefined
- ✅ Display counters update correctly

### Test 2.3: Log Capture
**Objective:** Verify logs are captured from background/content scripts

**Steps:**
1. Keep debug console open
2. Add/remove products in popup
3. Navigate to product pages
4. Observe logs appearing in console

**Expected Results:**
- ✅ Logs appear in real-time
- ✅ Proper categorization (info, success, warning, error)
- ✅ Source filtering works
- ✅ No message handler errors

### Test 2.4: Auto-Scroll
**Objective:** Test auto-scroll behavior

**Steps:**
1. Enable auto-scroll (should be on by default)
2. Generate many logs (by performing various actions)
3. Verify console auto-scrolls to bottom
4. Toggle auto-scroll off
5. Generate more logs

**Expected Results:**
- ✅ Auto-scroll works when enabled
- ✅ Console stays at current position when disabled
- ✅ requestAnimationFrame ensures smooth scrolling

### Test 2.5: Export Functionality
**Objective:** Test log export feature

**Steps:**
1. Generate several log entries
2. Click "Dışa Aktar" (Export) button
3. Save the downloaded JSON file
4. Open and validate JSON structure

**Expected Results:**
- ✅ File downloads successfully
- ✅ JSON is properly formatted (valid JSON)
- ✅ Contains exportDate, totalLogs, counts, and logs array
- ✅ Log timestamps are ISO format strings
- ✅ Success message displays

### Test 2.6: Error Handling
**Objective:** Verify error handling for stats operations

**Steps:**
1. Disable internet connection or background script
2. Click refresh stats button
3. Check that error is logged gracefully

**Expected Results:**
- ✅ Error message logged to console
- ✅ No uncaught exceptions
- ✅ UI remains functional

## Test 3: popup.js - Price Listing

### Test 3.1: No Product Limit
**Objective:** Verify all products display without limits

**Steps:**
1. Add 20+ products to tracking
2. Open popup
3. Navigate to "Liste" tab
4. Scroll through product list

**Expected Results:**
- ✅ ALL products display (no artificial limit)
- ✅ Scrolling works smoothly
- ✅ No performance issues
- ✅ All products accessible

### Test 3.2: Large Dataset Performance
**Objective:** Test with 50+ products

**Steps:**
1. Add 50 or more products
2. Open popup
3. Switch to Liste tab
4. Scroll through entire list
5. Search for products
6. Perform actions (refresh, delete)

**Expected Results:**
- ✅ Initial render completes in < 1 second
- ✅ Smooth scrolling with no lag
- ✅ Search filters across ALL products
- ✅ Actions work on any product
- ✅ DocumentFragment optimization improves performance

### Test 3.3: Search/Filter
**Objective:** Verify search works across all products

**Steps:**
1. With many products tracked, use search box
2. Enter various search terms
3. Verify results update in real-time

**Expected Results:**
- ✅ Search filters ALL products (not just first 10)
- ✅ Results update as you type (300ms debounce)
- ✅ Clear button works
- ✅ "No results" message when appropriate

### Test 3.4: CSS Scrolling
**Objective:** Verify CSS overflow scrolling works

**Steps:**
1. Add enough products to exceed viewport height
2. Verify scrollbar appears
3. Test scrolling with mouse wheel and scrollbar

**Expected Results:**
- ✅ Scrollbar appears when needed
- ✅ Custom scrollbar styling applied
- ✅ Smooth scrolling behavior
- ✅ Scroll position maintained during operations

## Performance Benchmarks

### Expected Performance Metrics:
- **Picker Activation:** < 100ms
- **Selector Generation:** < 50ms per element
- **Debug Console Load:** < 500ms
- **Product List Render (50 items):** < 1000ms
- **Search Filter (50 items):** < 100ms

## Known Limitations
- Picker may have difficulty with heavily obfuscated class names
- Debug console message listener requires background script to be active
- Very large product lists (>100 items) may show slight lag on low-end devices

## Reporting Issues
If any test fails:
1. Note the exact steps to reproduce
2. Capture browser console errors
3. Take screenshots if visual issues occur
4. Document browser version and OS
5. Report via GitHub issues

## Success Criteria
All tests must pass with ✅ for the fixes to be considered complete.

## Automated Testing (Future Enhancement)
Consider adding:
- Unit tests for selector generation algorithm
- Integration tests for message passing
- Performance tests for large datasets
- E2E tests with Playwright or Selenium
