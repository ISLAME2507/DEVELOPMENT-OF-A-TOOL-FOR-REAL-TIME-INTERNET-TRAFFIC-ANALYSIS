document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('chartModal');
    const modalChartContainer = document.querySelector('.modal-chart-container');
    const span = document.getElementsByClassName('close-modal')[0];
    let activeChart = null;
    let originalChartInstance = null;

    span.onclick = function() {
        closeModal();
    };

    window.onclick = function(event) {
        if (event.target == modal) {
            closeModal();
        }
    };

    function closeModal() {
        modal.style.display = 'none';
        if (activeChart) {
            activeChart.destroy();
            activeChart = null;
        }
    }

    window.addEventListener('resize', function() {
        if (activeChart) {
            activeChart.resize();
        }
    });
});