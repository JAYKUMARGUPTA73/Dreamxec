const prisma = require('../../config/prisma');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const {uploadToS3} = require('../../utils/uploadToS3');

// ─────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/i;
const PHONE_REGEX = /^[0-9]{10}$/;

/**
 * Calculate profile completion percentage for a User (student)
 */
function calcStudentCompletion(u) {
  const fields = [
    u.name, u.email, u.phone, u.gender, u.dateOfBirth,
    u.college, u.yearOfStudy, u.address, u.bio,
    u.skills?.length > 0,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

/**
 * Calculate profile completion percentage for a Donor
 */
function calcDonorCompletion(d) {
  const fields = [
    d.name, d.phone, d.gender, d.dateOfBirth,
    d.panNumber, d.education, d.occupation, d.address, d.bio,
  ];
  const filled = fields.filter(Boolean).length;
  return Math.round((filled / fields.length) * 100);
}

// ─────────────────────────────────────────────────
// GET /api/profile/me
// ─────────────────────────────────────────────────
exports.getMyProfile = catchAsync(async (req, res, next) => {
  const { id } = req.user;
  const isDonor = req.user.role === 'DONOR';

  let profile;

  if (isDonor) {
    profile = await prisma.donor.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        organizationName: true,
        verified: true,
        emailVerified: true,
        accountStatus: true,
        profilePicture: true,
        phone: true,
        countryCode: true,
        gender: true,
        dateOfBirth: true,
        panNumber: true,
        education: true,
        occupation: true,
        address: true,
        instagram: true,
        facebook: true,
        twitterX: true,
        reddit: true,
        bio: true,
        donationCategories: true,
        anonymousDonation: true,
        profileComplete: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!profile) return next(new AppError('Donor profile not found', 404));

    const completionPct = calcDonorCompletion(profile);
    return res.status(200).json({
      status: 'success',
      data: { profile, completionPct, role: 'DONOR' },
    });
  }

  // Default: User (student / president / admin)
  profile = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      studentVerified: true,
      accountStatus: true,
      profilePicture: true,
      phone: true,
      countryCode: true,
      gender: true,
      dateOfBirth: true,
      college: true,
      yearOfStudy: true,
      address: true,
      instagram: true,
      facebook: true,
      twitterX: true,
      reddit: true,
      bio: true,
      skills: true,
      projectTitle: true,
      fundingRequired: true,
      portfolioUrl: true,
      githubUrl: true,
      linkedinUrl: true,
      profileComplete: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!profile) return next(new AppError('User profile not found', 404));

  const completionPct = calcStudentCompletion(profile);
  return res.status(200).json({
    status: 'success',
    data: { profile, completionPct, role: profile.role },
  });
});

// ─────────────────────────────────────────────────
// PUT /api/profile/me
// ─────────────────────────────────────────────────
exports.updateMyProfile = catchAsync(async (req, res, next) => {
  const { id } = req.user;
  const isDonor = req.user.role === 'DONOR';

  // Disallow role changes
  if (req.body.role !== undefined || req.body.accountType !== undefined) {
    return next(new AppError('Role cannot be changed via this endpoint.', 400));
  }

  // Disallow email changes
  if (req.body.email !== undefined) {
    return next(new AppError('Email cannot be changed via this endpoint.', 400));
  }

  // ── DONOR update ──
  if (isDonor) {
    const {
      name, phone, countryCode, gender, dateOfBirth, panNumber,
      education, occupation, address, instagram, facebook, twitterX,
      reddit, bio, profilePicture, donationCategories, anonymousDonation,
    } = req.body;

    // Validate PAN if provided
    if (panNumber && !PAN_REGEX.test(panNumber.trim())) {
      return next(new AppError('Invalid PAN format. Expected pattern: ABCDE1234F', 400));
    }

    // Validate phone if provided
    if (phone && !PHONE_REGEX.test(phone.trim())) {
      return next(new AppError('Phone number must be exactly 10 digits.', 400));
    }

    // Validate DOB
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      if (isNaN(dob.getTime())) return next(new AppError('Invalid date of birth.', 400));
      const ageMs = Date.now() - dob.getTime();
      const age = ageMs / (1000 * 60 * 60 * 24 * 365.25);
      if (age < 13) return next(new AppError('You must be at least 13 years old.', 400));
    }

    const updateData = {};
    if (name !== undefined)               updateData.name               = name;
    if (phone !== undefined)              updateData.phone              = phone;
    if (countryCode !== undefined)        updateData.countryCode        = countryCode;
    if (gender !== undefined)             updateData.gender             = gender;
    if (dateOfBirth !== undefined)        updateData.dateOfBirth        = new Date(dateOfBirth);
    if (panNumber !== undefined)          updateData.panNumber          = panNumber?.trim().toUpperCase();
    if (education !== undefined)          updateData.education          = education;
    if (occupation !== undefined)         updateData.occupation         = occupation;
    if (address !== undefined)            updateData.address            = address;
    if (instagram !== undefined)          updateData.instagram          = instagram;
    if (facebook !== undefined)           updateData.facebook           = facebook;
    if (twitterX !== undefined)           updateData.twitterX           = twitterX;
    if (reddit !== undefined)             updateData.reddit             = reddit;
    if (bio !== undefined)                updateData.bio                = bio;
    if (profilePicture !== undefined)     updateData.profilePicture     = profilePicture;
    if (donationCategories !== undefined) updateData.donationCategories = donationCategories;
    if (anonymousDonation !== undefined)  updateData.anonymousDonation  = anonymousDonation;

    const updated = await prisma.donor.upsert({
      where: { id },
      update: updateData,
      create: {
        id,
        name: req.user.name || updateData.name || '',
        email: req.user.email,
        ...updateData,
      },
    });

    const completionPct = calcDonorCompletion(updated);
    const isComplete = completionPct >= 80;
    if (updated.profileComplete !== isComplete) {
      await prisma.donor.update({ where: { id }, data: { profileComplete: isComplete } });
      updated.profileComplete = isComplete;
    }

    return res.status(200).json({
      status: 'success',
      data: { profile: updated, completionPct, role: 'DONOR' },
    });
  }

  // ── USER (student) update ──
  const {
    name, phone, countryCode, gender, dateOfBirth,
    college, yearOfStudy, address, instagram, facebook,
    twitterX, reddit, bio, profilePicture, skills,
    projectTitle, fundingRequired, portfolioUrl, githubUrl, linkedinUrl,
  } = req.body;

  // Validate phone
  if (phone && !PHONE_REGEX.test(phone.trim())) {
    return next(new AppError('Phone number must be exactly 10 digits.', 400));
  }

  // Validate DOB
  if (dateOfBirth) {
    const dob = new Date(dateOfBirth);
    if (isNaN(dob.getTime())) return next(new AppError('Invalid date of birth.', 400));
    const ageMs = Date.now() - dob.getTime();
    const age = ageMs / (1000 * 60 * 60 * 24 * 365.25);
    if (age < 13) return next(new AppError('You must be at least 13 years old.', 400));
  }

  const updateData = {};
  if (name !== undefined)          updateData.name          = name;
  if (phone !== undefined)         updateData.phone         = phone;
  if (countryCode !== undefined)   updateData.countryCode   = countryCode;
  if (gender !== undefined)        updateData.gender        = gender;
  if (dateOfBirth !== undefined)   updateData.dateOfBirth   = new Date(dateOfBirth);
  if (college !== undefined)       updateData.college       = college;
  if (yearOfStudy !== undefined)   updateData.yearOfStudy   = yearOfStudy;
  if (address !== undefined)       updateData.address       = address;
  if (instagram !== undefined)     updateData.instagram     = instagram;
  if (facebook !== undefined)      updateData.facebook      = facebook;
  if (twitterX !== undefined)      updateData.twitterX      = twitterX;
  if (reddit !== undefined)        updateData.reddit        = reddit;
  if (bio !== undefined)           updateData.bio           = bio;
  if (profilePicture !== undefined) updateData.profilePicture = profilePicture;
  if (skills !== undefined)        updateData.skills        = skills;
  if (projectTitle !== undefined)  updateData.projectTitle  = projectTitle;
  if (fundingRequired !== undefined) updateData.fundingRequired = fundingRequired;
  if (portfolioUrl !== undefined)  updateData.portfolioUrl  = portfolioUrl;
  if (githubUrl !== undefined)     updateData.githubUrl     = githubUrl;
  if (linkedinUrl !== undefined)   updateData.linkedinUrl   = linkedinUrl;

  const updated = await prisma.user.update({ where: { id }, data: updateData });

  const completionPct = calcStudentCompletion(updated);
  const isComplete = completionPct >= 80;
  if (updated.profileComplete !== isComplete) {
    await prisma.user.update({ where: { id }, data: { profileComplete: isComplete } });
    updated.profileComplete = isComplete;
  }

  return res.status(200).json({
    status: 'success',
    data: { profile: updated, completionPct, role: updated.role },
  });
});

// ─────────────────────────────────────────────────
// POST /api/profile/picture
// ─────────────────────────────────────────────────
exports.updateProfilePicture = catchAsync(async (req, res, next) => {
  const { id } = req.user;
  const isDonor = req.user.role === 'DONOR';

  if (!req.file) {
    return next(new AppError('Please upload an image', 400));
  }

  const folder = `dreamxec/users/${id}/profile`;
  const url = await uploadToS3(req.file, folder);

  if (!url) {
    return next(new AppError('Failed to upload image', 500));
  }

  let updated;
  if (isDonor) {
    updated = await prisma.donor.update({ where: { id }, data: { profilePicture: url } });
  } else {
    updated = await prisma.user.update({ where: { id }, data: { profilePicture: url } });
  }

  res.status(200).json({
    status: 'success',
    data: {
      profilePicture: url,
      profile: updated
    }
  });
});
