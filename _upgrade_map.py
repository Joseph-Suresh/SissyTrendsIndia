"""
Upgrades map picker:
1. Restricts to India bounds only
2. Calculates shipping cost from Saravanampatti, Coimbatore
3. Shows shipping cost in map modal
4. Adds address column to admin orders table
Run: python _upgrade_map.py
"""
import os, re

BASE = os.path.dirname(os.path.abspath(__file__))
js_path   = os.path.join(BASE, 'js', 'main.js')
admin_path = os.path.join(BASE, 'admin', 'index.html')

# ── 1. Replace map functions in main.js ──────────────────────────
with open(js_path, 'r', encoding='utf-8') as f:
    c = f.read()

new_map = r"""function loadLeaflet(cb) {
  if (window.L) { cb(); return; }
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
  var script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  script.onload = cb;
  document.head.appendChild(script);
}

// Saravanampatti, Coimbatore — warehouse origin
var ORIGIN_LAT = 11.0780, ORIGIN_LON = 77.0347;

// India bounding box
var INDIA_BOUNDS = [[6.5546079, 68.1113787], [35.6745457, 97.395561]];

function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = (lat2-lat1)*Math.PI/180;
  var dLon = (lon2-lon1)*Math.PI/180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2)
        + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)
        * Math.sin(dLon/2)*Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function calcShipping(distKm) {
  if (distKm <= 50)  return { cost: 0,   label: 'Free Delivery' };
  if (distKm <= 200) return { cost: 60,  label: 'Standard Delivery ₹60' };
  if (distKm <= 500) return { cost: 100, label: 'Standard Delivery ₹100' };
  return { cost: 150, label: 'Long Distance Delivery ₹150' };
}

function openMapPicker() {
  var mapModal = document.getElementById('mapPickerModal');
  if (!mapModal) {
    mapModal = document.createElement('div');
    mapModal.id = 'mapPickerModal';
    mapModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px';
    mapModal.innerHTML =
      '<div style="background:#faf5ec;width:100%;max-width:580px;border:1px solid rgba(201,162,78,.3)">'
      +'<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(201,162,78,.2)">'
      +'<span style="font-family:\'Cinzel\',serif;font-size:10px;letter-spacing:.2em;color:#7a1f2e">PIN YOUR DELIVERY LOCATION</span>'
      +'<button onclick="closeMapPicker()" style="background:none;border:none;font-size:22px;cursor:pointer;color:rgba(122,31,46,.4)">&times;</button>'
      +'</div>'
      +'<div id="leafletMap" style="height:340px;width:100%"></div>'
      +'<div style="padding:14px 16px;border-top:1px solid rgba(201,162,78,.2)">'
      +'<div id="mapAddressPreview" style="font-family:\'Jost\',sans-serif;font-size:12px;color:#5c3d1e;min-height:18px;margin-bottom:6px">Move the pin to your exact location</div>'
      +'<div id="mapShippingInfo" style="font-family:\'Jost\',sans-serif;font-size:11px;padding:8px 12px;background:#f0ebe0;border:1px solid rgba(201,162,78,.2);margin-bottom:10px;display:none">'
      +'<span id="mapDistLabel" style="color:#8c7b6b"></span>'
      +'<span id="mapShipLabel" style="color:#7a1f2e;font-weight:600;float:right"></span>'
      +'</div>'
      +'<div id="mapIndiaError" style="display:none;color:#c0392b;font-family:\'Jost\',sans-serif;font-size:11px;margin-bottom:8px">&#9888; We only deliver within India. Please pin a location inside India.</div>'
      +'<button onclick="confirmMapAddress()" id="mapConfirmBtn" style="width:100%;padding:11px;background:#7a1f2e;border:none;color:#faf5ec;font-family:\'Jost\',sans-serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;cursor:pointer">Confirm This Location</button>'
      +'</div>'
      +'</div>';
    document.body.appendChild(mapModal);
  }
  mapModal.style.display = 'flex';

  loadLeaflet(function() {
    setTimeout(function() {
      if (window._leafletMap) { window._leafletMap.remove(); window._leafletMap = null; }

      // Default: Coimbatore
      var defaultLat = 11.0168, defaultLon = 76.9558;
      var indiaBounds = window.L.latLngBounds([[6.55, 68.11], [35.67, 97.40]]);
      var map = window.L.map('leafletMap', { maxBounds: indiaBounds, maxBoundsViscosity: 1.0 })
                        .setView([defaultLat, defaultLon], 11);
      window._leafletMap = map;

      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', minZoom: 5, maxZoom: 18
      }).addTo(map);

      // Origin marker (warehouse)
      window.L.circleMarker([ORIGIN_LAT, ORIGIN_LON], {
        radius: 7, color: '#c9a24e', fillColor: '#c9a24e', fillOpacity: 0.8, weight: 2
      }).addTo(map).bindPopup('<b style="font-size:11px">SissyTrends Warehouse<br>Saravanampatti, Coimbatore</b>');

      var marker = window.L.marker([defaultLat, defaultLon], { draggable: true }).addTo(map);
      window._mapMarker = marker;
      window._mapAddress = '';
      window._mapShipping = 0;
      window._mapDistKm = 0;

      function isInIndia(lat, lon) {
        return lat >= 6.55 && lat <= 35.67 && lon >= 68.11 && lon <= 97.40;
      }

      function updateShippingUI(lat, lon) {
        var errEl  = document.getElementById('mapIndiaError');
        var shipEl = document.getElementById('mapShippingInfo');
        var distEl = document.getElementById('mapDistLabel');
        var costEl = document.getElementById('mapShipLabel');
        var btn    = document.getElementById('mapConfirmBtn');

        if (!isInIndia(lat, lon)) {
          if (errEl) errEl.style.display = 'block';
          if (shipEl) shipEl.style.display = 'none';
          if (btn) { btn.disabled = true; btn.style.opacity = '0.4'; }
          window._mapShipping = -1;
          return;
        }

        if (errEl) errEl.style.display = 'none';
        if (btn) { btn.disabled = false; btn.style.opacity = '1'; }

        var distKm = Math.round(haversineKm(ORIGIN_LAT, ORIGIN_LON, lat, lon));
        window._mapDistKm = distKm;
        var ship = calcShipping(distKm);
        window._mapShipping = ship.cost;

        if (shipEl) shipEl.style.display = 'block';
        if (distEl) distEl.textContent = '~' + distKm + ' km from warehouse';
        if (costEl) costEl.textContent = ship.label;
      }

      function reverseGeocode(lat, lon) {
        var base = (window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1')
          ? 'http://localhost:5000' : '';
        fetch(base+'/api/geocode?lat='+lat+'&lon='+lon)
          .then(function(r){return r.json();})
          .then(function(d){
            var addr = d.location || (lat.toFixed(4)+', '+lon.toFixed(4));
            window._mapAddress = addr;
            var el = document.getElementById('mapAddressPreview');
            if (el) el.textContent = '\uD83D\uDCCD '+addr;
            updateShippingUI(lat, lon);
          }).catch(function(){
            window._mapAddress = lat.toFixed(4)+', '+lon.toFixed(4);
            updateShippingUI(lat, lon);
          });
      }

      marker.on('dragend', function(e) {
        var pos = e.target.getLatLng();
        // Clamp to India
        if (!isInIndia(pos.lat, pos.lng)) {
          var clamped = indiaBounds.getCenter();
          marker.setLatLng(clamped);
          reverseGeocode(clamped.lat, clamped.lng);
        } else {
          reverseGeocode(pos.lat, pos.lng);
        }
      });

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(pos) {
          var lat = pos.coords.latitude, lon = pos.coords.longitude;
          if (isInIndia(lat, lon)) {
            map.setView([lat, lon], 14);
            marker.setLatLng([lat, lon]);
            reverseGeocode(lat, lon);
          } else {
            reverseGeocode(defaultLat, defaultLon);
          }
        }, function() {
          reverseGeocode(defaultLat, defaultLon);
        }, { timeout: 6000 });
      } else {
        reverseGeocode(defaultLat, defaultLon);
      }

      setTimeout(function(){ map.invalidateSize(); }, 100);
    }, 100);
  });
}

function closeMapPicker() {
  var m = document.getElementById('mapPickerModal');
  if (m) m.style.display = 'none';
}

function confirmMapAddress() {
  if (window._mapShipping === -1) return; // outside India
  var addr    = window._mapAddress || '';
  var distKm  = window._mapDistKm || 0;
  var ship    = window._mapShipping || 0;
  var el = document.getElementById('scAddress');
  if (el && addr) el.value = addr;
  // Show shipping info below address field
  var shipEl = document.getElementById('scShippingInfo');
  if (!shipEl) {
    shipEl = document.createElement('div');
    shipEl.id = 'scShippingInfo';
    shipEl.style.cssText = 'font-family:\'Jost\',sans-serif;font-size:11px;padding:8px 12px;background:#f0ebe0;border:1px solid rgba(201,162,78,.2);margin-top:6px';
    var addrInput = el ? el.parentNode : null;
    if (addrInput) addrInput.appendChild(shipEl);
  }
  var shipTxt = calcShipping(distKm);
  shipEl.innerHTML = '<span style="color:#8c7b6b">~'+distKm+' km from warehouse &mdash; </span><span style="color:#7a1f2e;font-weight:600">'+shipTxt.label+'</span>';
  window._checkoutShipping = ship;
  window._checkoutDistKm   = distKm;
  closeMapPicker();
}
"""

# Find and replace the old map block
old_start = c.find('function loadLeaflet(cb) {')
old_end   = c.find('\nfunction closeSimpleCheckout() {')
if old_start > 0 and old_end > 0:
    c = c[:old_start] + new_map + '\n' + c[old_end:]
    print('  + Map functions replaced')
else:
    print(f'  ! Bounds not found: start={old_start} end={old_end}')

# Pass shipping to checkout callback
c = c.replace(
    "modal._callback({ name: name, phone: '91'+phone, email: email, address: address });",
    "modal._callback({ name: name, phone: '91'+phone, email: email, address: address, shipping: window._checkoutShipping||0, distKm: window._checkoutDistKm||0 });",
    1
)
print('  + Shipping passed to checkout callback')

with open(js_path, 'w', encoding='utf-8') as f:
    f.write(c)
print('  main.js updated')

# ── 2. Add Address column to admin orders table ───────────────────
with open(admin_path, 'r', encoding='utf-8') as f:
    a = f.read()

# Add Address header after Phone
a = a.replace(
    "+'<td style=\"color:rgba(250,245,236,.6);font-size:12px\">'+(o.customer_phone||'&mdash;')+'</td>'",
    "+'<td style=\"color:rgba(250,245,236,.6);font-size:12px\">'+(o.customer_phone||'&mdash;')+'</td>'"
    "+'<td style=\"color:rgba(201,162,78,.6);font-size:11px;max-width:160px\">'+(o.customer_address||'&mdash;')+'</td>'",
    1
)

# Add Address header in thead
a = a.replace(
    "<th>Order ID</th><th>Payment ID</th><th>Product</th><th>Customer</th><th>Phone</th><th>Amount</th><th>Status</th><th>Date</th>",
    "<th>Order ID</th><th>Payment ID</th><th>Product</th><th>Customer</th><th>Phone</th><th>Address</th><th>Amount</th><th>Status</th><th>Date</th>",
    1
)

# Fix colspan
a = a.replace('colspan="8"', 'colspan="9"', 1)

with open(admin_path, 'w', encoding='utf-8') as f:
    f.write(a)
print('  admin orders table updated with Address column')

print('\nDone. Restart start.bat and hard refresh.')
os.remove(__file__)
