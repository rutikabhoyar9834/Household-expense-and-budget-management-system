// Global helper functions
function formatCurrency(amount, currency = 'INR') {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
}

function formatDate(dateString, format = 'short') {
    const date = new Date(dateString);
    if (format === 'short') {
        return date.toLocaleDateString('en-IN');
    } else if (format === 'long') {
        return date.toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
    return date.toLocaleDateString('en-IN');
}

function showLoading() {
    $('#loadingSpinner').show();
}

function hideLoading() {
    $('#loadingSpinner').hide();
}

function showToast(message, type = 'success') {
    const toast = $(`
        <div class="toast align-items-center text-white bg-${type} border-0 position-fixed bottom-0 end-0 m-3" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `);
    
    $('body').append(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function confirmAction(message, callback) {
    const modal = $(`
        <div class="modal fade" tabindex="-1">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Confirm Action</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary confirm-btn">Confirm</button>
                    </div>
                </div>
            </div>
        </div>
    `);
    
    modal.modal('show');
    
    modal.find('.confirm-btn').on('click', function() {
        modal.modal('hide');
        if (callback) callback();
    });
    
    modal.on('hidden.bs.modal', function() {
        modal.remove();
    });
}

// AJAX setup for CSRF token (if needed)
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        // Add CSRF token if needed
        const csrfToken = $('meta[name="csrf-token"]').attr('content');
        if (csrfToken) {
            xhr.setRequestHeader('X-CSRFToken', csrfToken);
        }
    }
});

// Global error handler for AJAX
$(document).ajaxError(function(event, xhr, settings, error) {
    if (xhr.status === 401) {
        showToast('Session expired. Please login again.', 'danger');
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    } else if (xhr.status === 500) {
        showToast('Server error. Please try again later.', 'danger');
    } else {
        showToast('An error occurred. Please try again.', 'danger');
    }
});

// Initialize tooltips and popovers
$(document).ready(function() {
    // Initialize all tooltips
    $('[data-bs-toggle="tooltip"]').tooltip();
    
    // Initialize all popovers
    $('[data-bs-toggle="popover"]').popover();
    
    // Add fade-out effect to alerts
    $('.alert').delay(5000).fadeOut('slow', function() {
        $(this).remove();
    });
});

// Dark mode toggle
function toggleDarkMode() {
    $('body').toggleClass('dark-mode');
    localStorage.setItem('darkMode', $('body').hasClass('dark-mode'));
}

// Load dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
    $('body').addClass('dark-mode');
}

// Export functions for global use
window.formatCurrency = formatCurrency;
window.formatDate = formatDate;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast;
window.confirmAction = confirmAction;
window.toggleDarkMode = toggleDarkMode;
