document.getElementById('idForm').addEventListener('submit', async function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const generateBtn = document.getElementById('generateBtn');
    const loader = document.getElementById('loader');
    const previewSection = document.getElementById('previewSection');

    // UI Feedback
    generateBtn.disabled = true;
    generateBtn.style.opacity = '0.7';
    loader.classList.remove('hidden');
    previewSection.classList.add('hidden');

    try {
        const response = await fetch('http://localhost:3001/generate-card', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (data.success) {
            // Update Preview
            const cardPreview = document.getElementById('cardPreview');
            cardPreview.src = data.pngUrl;

            // Update Download Links
            const downloadPng = document.getElementById('downloadPng');
            downloadPng.href = data.pngUrl;

            const downloadPdf = document.getElementById('downloadPdf');
            downloadPdf.href = data.pdfUrl;

            // Show Section
            previewSection.classList.remove('hidden');

            // Scroll to preview on mobile
            if (window.innerWidth < 900) {
                previewSection.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            alert('Error generating card: ' + (data.error || 'Unknown error'));
        }

    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.style.opacity = '1';
        loader.classList.add('hidden');
    }
});

// Form Dynamics
const cardTypeSelect = document.getElementById('card_type');
const jobTitleSelect = document.getElementById('job_title');
const nameLabel = document.getElementById('nameLabel');
const jobNumberLabel = document.getElementById('jobNumberLabel');
const formHeading = document.getElementById('formHeading');

const employeeOptions = `
    <option value="" disabled selected>اختر المسمى...</option>
    <option value="سائق حافلة">سائق حافلة (Driver)</option>
    <option value="مشرفة حافلة">مشرفة حافلة (Supervisor)</option>
    <option value="موظف إداري">موظف إداري (Admin)</option>
`;

const studentOptions = `
    <option value="طالب - ابتدائي">ابتدائي (Primary)</option>
    <option value="طالب - إعدادي">إعدادي (Middle)</option>
    <option value="طالب - ثانوي">ثانوي (High)</option>
    <option value="طالب - جامعي">جامعي (University)</option>
`;

cardTypeSelect.addEventListener('change', function (e) {
    const selectedType = e.target.value;
    const studentFields = document.getElementById('studentFields');
    const jobTitleLabel = document.getElementById('jobTitleLabel');

    if (selectedType === 'student') {
        formHeading.textContent = 'بيانات الطالب';
        nameLabel.textContent = 'اسم الطالب';
        jobNumberLabel.textContent = 'الرقم الجامعي/المدرسي';
        jobTitleLabel.textContent = 'المرحلة الدراسية';
        document.getElementById('job_number').placeholder = 'مثال: std-2024';

        jobTitleSelect.innerHTML = studentOptions;
        studentFields.style.display = 'block';

        // Make student fields required when visible
        document.getElementById('dob').required = true;
        document.getElementById('email').required = true;
        document.getElementById('phone').required = true;
    } else {
        formHeading.textContent = 'بيانات الموظف';
        nameLabel.textContent = 'اسم الموظف';
        jobNumberLabel.textContent = 'الرقم الوظيفي';
        jobTitleLabel.textContent = 'المسمى الوظيفي';
        document.getElementById('job_number').placeholder = 'مثال: 073';

        jobTitleSelect.innerHTML = employeeOptions;
        studentFields.style.display = 'none';

        // Remove required from student fields when hidden
        document.getElementById('dob').required = false;
        document.getElementById('email').required = false;
        document.getElementById('phone').required = false;
    }
});

// File input label update
document.getElementById('photo').addEventListener('change', function (e) {
    const fileName = e.target.files[0] ? e.target.files[0].name : 'اضغط لرفع الصورة...';
    document.getElementById('file-label').textContent = fileName;
});
