document.addEventListener("DOMContentLoaded", () => {
  // ===============================
  // Shared Store Dataset (REAL DATA)
  // ===============================
  const stores = {
    "abuja": [
      {
        name: "Novacrest Hospital, Gwagwalada (Formerly Pick Specialist Hospital and Diagnostic Center)",
        lat: 8.951763760512394,
        lon: 7.077318562768756
      }
    ],
    "ibadan": [
      {
        name: "VIVE Healthcare Ltd",
        lat: 7.366884888747286,
        lon: 3.857833119357894
      }
    ],
    "manchester": [
      {
        name: "Vive Natural Limited (UK)",
        lat: 53.46397496728575,
        lon: -2.1825910741600474
      }
    ],
    "lagos": [
      {
        name: "DAPLAR Pharmacy (Opp LASUTH, Ikeja)",
        lat: 6.5932413994451124,
        lon: 3.3430331681188754
      },
      {
        name: "Raanan Enterprises (Victory Park Estate, Lekki)",
        lat: 6.445170740805577,
        lon: 3.502860405312319
      },
      {
        name: "Faith Exchange International Ventures (Iju, Lagos)",
        lat: 6.659350942324658,
        lon: 3.3431838160602667
      }
    ],
    "port harcourt": [
      {
        name: "Faith Exchange International Ventures (Old Aba Road, PH)",
        lat: 4.840287997235142,
        lon: 7.0390073527702555
      }
    ]
  };

  const allStores = () => Object.values(stores).flat();

  // ... (footer map setup unchanged)

  const modalEl = document.getElementById("storeLocatorModal");
  const listEl  = document.getElementById("store-list");
  const mapEl   = document.getElementById("store-map-popup");
  const findBtn = document.getElementById("find-store-btn");
  const inputEl = document.getElementById("location-input");

  let modalMap = null;
  let modalMarkers = [];

  function initModalMap() {
    if (modalMap || !mapEl) return;
    modalMap = L.map(mapEl).setView([9.082, 8.6753], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(modalMap);
  }

  function clearModalMarkers() {
    if (!modalMap) return;
    modalMarkers.forEach(m => modalMap.removeLayer(m));
    modalMarkers = [];
  }

  // 🔹 Reusable: populate modal with stores
  function populateModal(found, highlightName = null) {
    initModalMap();
    clearModalMarkers();
    if (listEl) listEl.innerHTML = "";

    const bounds = [];
    found.forEach(store => {
      const marker = L.marker([store.lat, store.lon]).addTo(modalMap)
        .bindPopup(`<b>${store.name}</b>`);
      modalMarkers.push(marker);
      bounds.push([store.lat, store.lon]);

      if (listEl) {
        const li = document.createElement("li");
        li.className = "list-group-item list-group-item-action";
        li.style.cursor = "pointer";
        li.textContent = store.name;

        // highlight if it's the nearest
        if (highlightName && store.name === highlightName) {
          li.classList.add("active", "fw-bold");
        }

        li.addEventListener("click", () => {
          modalMap.setView([store.lat, store.lon], 14);
          marker.openPopup();
        });
        listEl.appendChild(li);
      }
    });

    if (bounds.length) modalMap.fitBounds(bounds, { padding: [20, 20] });
    setTimeout(() => modalMap.invalidateSize(), 100);
  }

  // 🔹 Search flow unchanged
  function findStoresByLocation(query) {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    if (stores[q]) return stores[q];

    for (const city in stores) {
      if (q.includes(city) || city.includes(q)) return stores[city];
      if (stores[city].some(s => s.name.toLowerCase().includes(q))) return stores[city];
    }
    return null;
  }

  function showStoresInModal(query) {
    const found = findStoresByLocation(query);
    if (!found) {
      alert(`Sorry, no stores found for "${query}".`);
      return;
    }

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    function onShown() {
      populateModal(found);
      modalEl.removeEventListener("shown.bs.modal", onShown);
    }
    modalEl.addEventListener("shown.bs.modal", onShown);
  }

  if (findBtn && inputEl && modalEl) {
    findBtn.addEventListener("click", () => {
      const q = inputEl.value;
      if (!q) {
        alert("Please enter a location");
        return;
      }
      showStoresInModal(q);
    });
  }

  // ===============================
  // GEOLOCATION + ROUTING FEATURES
  // ===============================
  let userLocation = null;
  let routingControl = null;

  function getUserLocation(callback) {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        userLocation = [pos.coords.latitude, pos.coords.longitude];
        callback(userLocation);
      },
      err => {
        alert("Unable to fetch location: " + err.message);
      }
    );
  }

  function findNearestStore(latlng) {
    let nearest = null;
    let minDist = Infinity;
    allStores().forEach(store => {
      const dist = L.latLng(latlng).distanceTo([store.lat, store.lon]);
      if (dist < minDist) {
        minDist = dist;
        nearest = store;
      }
    });
    return nearest;
  }

  function showRouteToStore(store) {
    if (!modalMap) return;
    if (routingControl) modalMap.removeControl(routingControl);

    routingControl = L.Routing.control({
      waypoints: [
        L.latLng(userLocation[0], userLocation[1]),
        L.latLng(store.lat, store.lon)
      ],
      routeWhileDragging: false,
      createMarker: (i, wp) => {
        return L.marker(wp.latLng, {
          draggable: false,
          icon: L.icon({
            iconUrl: i === 0 
              ? "https://cdn-icons-png.flaticon.com/512/64/64113.png"
              : "https://cdn-icons-png.flaticon.com/512/684/684908.png",
            iconSize: [30, 30]
          })
        });
      }
    }).addTo(modalMap);
  }

  // 🔹 Highlight nearest store + route
  document.getElementById("find-nearest-store-btn")?.addEventListener("click", () => {
    getUserLocation(loc => {
      const nearest = findNearestStore(loc);
      if (!nearest) {
        alert("No stores found nearby.");
        return;
      }

      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();

      modalEl.addEventListener("shown.bs.modal", function onShown() {
        populateModal([nearest], nearest.name); // highlight + show only nearest
        modalMap.setView([nearest.lat, nearest.lon], 13);
        setTimeout(() => showRouteToStore(nearest), 500);
        modalEl.removeEventListener("shown.bs.modal", onShown);
      });
    });
  });
});
