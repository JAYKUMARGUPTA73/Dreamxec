const {uploadToS3} = require('../../utils/uploadToS3');
const AppError = require('../../utils/AppError');
const catchAsync = require('../../utils/catchAsync');

exports.uploadFiles = catchAsync(async (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next(new AppError('No files uploaded', 400));
  }

  const uploadPromises = req.files.map(async (file) => {
    // Determine folder based on file type and campaign ID
    const campaignId = req.query.campaignId || req.body.campaignId;
    if (!campaignId) {
       throw new Error('Campaign ID is required for upload');
    }

    let folder = `dreamxec/campaigns/${campaignId}/others`; // Fallback
    let resourceType = 'auto';
    
    if (file.mimetype.startsWith('image/')) {
      folder = `dreamxec/campaigns/${campaignId}/images`;
    } else if (file.mimetype === 'application/pdf' || file.mimetype.includes('powerpoint') || file.mimetype.includes('presentation')) {
      folder = `dreamxec/campaigns/${campaignId}/documents/campaign-deck`;
    } else if (file.mimetype.startsWith('video/')) {
       folder = `dreamxec/campaigns/${campaignId}/videos`;
    }

    const url = await uploadToS3(file, folder);
    return {
      originalName: file.originalname,
      mimeType: file.mimetype,
      url: url
    };
  });

  const results = await Promise.all(uploadPromises);

  res.status(200).json({
    status: 'success',
    data: {
      files: results
    }
  });
});
