// Set maintenance end time (ubah sesuai kebutuhan)
// Contoh: maintenance selesai dalam 2 jam dari sekarang
const maintenanceDuration = 2 * 60 * 60 * 1000; // 2 jam dalam milliseconds
const endTime = new Date(Date.now() + maintenanceDuration);

// Atau bisa manual:
// const endTime = new Date('2026-03-30T20:00:00'); // Format: YYYY-MM-DDTHH:MM:SS

function updateCountdown() {
    const now = new Date().getTime();
    const distance = endTime - now;
    
    if (distance < 0) {
        document.getElementById('countdown').innerHTML = '<div class="time-box" style="background: #8e44ad;"><div class="time-number">00</div><div class="time-label">Ready!</div></div>';
        document.getElementById('progress-percent').innerText = '100%';
        document.getElementById('progress-fill').style.width = '100%';
        return;
    }
    
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);
    
    document.getElementById('days').innerHTML = String(days).padStart(2, '0');
    document.getElementById('hours').innerHTML = String(hours).padStart(2, '0');
    document.getElementById('minutes').innerHTML = String(minutes).padStart(2, '0');
    document.getElementById('seconds').innerHTML = String(seconds).padStart(2, '0');
    
    // Update progress bar
    const totalDuration = maintenanceDuration;
    const elapsed = Date.now() - (endTime - maintenanceDuration);
    let percent = Math.min(100, Math.floor((elapsed / totalDuration) * 100));
    percent = Math.max(0, percent);
    document.getElementById('progress-percent').innerText = percent + '%';
    document.getElementById('progress-fill').style.width = percent + '%';
}

// Update countdown every second
updateCountdown();
setInterval(updateCountdown, 1000);

// Create floating particles
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    const particleCount = 50;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        const size = Math.random() * 4 + 2;
        particle.style.width = size + 'px';
        particle.style.height = size + 'px';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.animationDuration = Math.random() * 10 + 5 + 's';
        particle.style.animationDelay = Math.random() * 5 + 's';
        particle.style.opacity = Math.random() * 0.5 + 0.2;
        particlesContainer.appendChild(particle);
    }
}

createParticles();

// Handle notification form submission
document.getElementById('notifyForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const email = this.querySelector('input').value;
    
    localStorage.setItem('maintenance_notify_email', email);
    
    const btn = this.querySelector('button');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i> Terdaftar!';
    btn.style.background = '#2ed573';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = 'linear-gradient(135deg, #8e44ad, #a55eea)';
    }, 3000);
    
    this.querySelector('input').value = '';
    console.log('Email terdaftar untuk notifikasi:', email);
});

// Smooth scroll & animation
document.querySelectorAll('.social-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Social link clicked:', link.href);
    });
});
