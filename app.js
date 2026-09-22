// Frontend for EcoRoute — talks to the Java backend over the REST API
// exposed by ecoroute.WebServer (/api/deliveries, /api/summary).

const form = document.getElementById("delivery-form");
const formError = document.getElementById("form-error");
const logRows = document.getElementById("log-rows");
const totalEmissionsEl = document.getElementById("total-emissions");
const deliveryCountEl = document.getElementById("delivery-count");
const advisoryBanner = document.getElementById("advisory-banner");
const advisoryMessage = document.getElementById("advisory-message");

function vehicleBadgeClass(vehicleType) {
  if (vehicleType === "EV") return "badge-ev";
  if (vehicleType === "Diesel Van") return "badge-diesel";
  return "badge-petrol";
}

function renderLogs(logs) {
  if (logs.length === 0) {
    logRows.innerHTML = '<tr class="empty-row"><td colspan="5">No data logged yet today.</td></tr>';
    return;
  }
  logRows.innerHTML = logs.map(log => `
    <tr>
      <td>${escapeHtml(log.id)}</td>
      <td><span class="badge ${vehicleBadgeClass(log.vehicleType)}">${escapeHtml(log.vehicleType)}</span></td>
      <td>${escapeHtml(log.trafficLevel)}</td>
      <td>${log.distance.toFixed(1)} km</td>
      <td>${log.calculatedEmissions.toFixed(2)} g</td>
    </tr>
  `).join("");
}

function renderSummary(summary) {
  totalEmissionsEl.textContent = `${summary.totalEmissions.toFixed(2)} g`;
  deliveryCountEl.textContent = `${summary.deliveryCount} ${summary.deliveryCount === 1 ? "delivery" : "deliveries"} logged`;

  if (summary.advisoryTriggered) {
    advisoryMessage.textContent = summary.advisoryMessage;
    advisoryBanner.hidden = false;
  } else {
    advisoryBanner.hidden = true;
  }
}

// Minimal escaping since delivery IDs are free-text user input rendered as HTML.
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

async function refreshAll() {
  const [logsRes, summaryRes] = await Promise.all([
    fetch("/api/deliveries"),
    fetch("/api/summary"),
  ]);
  renderLogs(await logsRes.json());
  renderSummary(await summaryRes.json());
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;

  const body = new URLSearchParams({
    id: document.getElementById("routeId").value,
    distance: document.getElementById("distance").value,
    vehicleType: document.getElementById("vehicleType").value,
    trafficLevel: document.getElementById("trafficLevel").value,
  });

  const submitButton = form.querySelector("button");
  submitButton.disabled = true;

  try {
    const res = await fetch("/api/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to log delivery");
    }

    form.reset();
    await refreshAll();
  } catch (err) {
    formError.textContent = err.message;
    formError.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
});

refreshAll();
