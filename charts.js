let expensePieChart = null;
let monthlyTrendChart = null;

$(document).ready(function() {
    initializeCharts();
});

function initializeCharts() {
    // Expense Pie Chart
    const pieCtx = document.getElementById('expensePieChart').getContext('2d');
    if (expensePieChart) {
    expensePieChart.destroy();
}

    expensePieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#36A2EB'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${formatCurrency(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
    
    // Monthly Trend Chart
    const lineCtx = document.getElementById('monthlyTrendChart').getContext('2d');
    if (monthlyTrendChart) {
    monthlyTrendChart.destroy();
}

    monthlyTrendChart = new Chart(lineCtx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
            datasets: [
                {
                    label: 'Income',
                    data: [],
                    borderColor: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Expenses',
                    data: [],
                    borderColor: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Savings',
                    data: [],
                    borderColor: '#ff9800',
                    backgroundColor: 'rgba(255, 152, 0, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function updateExpensePieChart(categoryExpenses) {
    if (!expensePieChart || !categoryExpenses) return;
    
    const labels = categoryExpenses.map(item => item.category);
    const data = categoryExpenses.map(item => item.total);
    
    expensePieChart.data.labels = labels;
    expensePieChart.data.datasets[0].data = data;
    expensePieChart.update();
}

function updateMonthlyTrendChart(monthlyData) {
    if (!monthlyTrendChart || !monthlyData) return;
    
    const incomeData = monthlyData.map(item => item.income);
    const expenseData = monthlyData.map(item => item.expenses);
    const savingsData = monthlyData.map(item => item.savings);
    
    monthlyTrendChart.data.datasets[0].data = incomeData;
    monthlyTrendChart.data.datasets[1].data = expenseData;
    monthlyTrendChart.data.datasets[2].data = savingsData;
    monthlyTrendChart.update();
}

// Export charts for use in other pages
function exposeCharts() {
    window.expensePieChart = expensePieChart;
    window.monthlyTrendChart = monthlyTrendChart;
    window.updateExpensePieChart = updateExpensePieChart;
    window.updateMonthlyTrendChart = updateMonthlyTrendChart;
}

$(document).ready(function() {
    initializeCharts();
    exposeCharts();
});