
function createBookmarkCard(location) {

    return `
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm">
                <div class="card-body d-flex flex-column">
                    <div class="mb-2">
                    </div>
                    <h5 class="card-title">${location.properties.name() || 'Untitled Location'}</h5>
                    <a href="/" class="btn btn-primary btn-sm mt-auto">
                        View Full Details
                    </a>
                </div>
            </div>
        </div>
    `;
}